"""
Logs Home Assistant admins in to DSMR Reader when they open it through Ingress.

Home Assistant's Supervisor sends the user of an Ingress request in X-Remote-User-* headers and
drops headers of the same name that a browser sends. The app's web interface is also reachable on
its own port, where a browser could send these headers itself. So only the Ingress server of nginx
(which accepts only the Supervisor) adds a token that the app makes at each start, and this
middleware trusts the user headers only next to that token.

A session that this middleware logged in remembers the Home Assistant user. It lasts only while
every request comes through Ingress from that user, and that user is still an admin: another Home
Assistant user in the same browser, a lost admin role, or the app's own port (the browser sends the
session cookie there too) logs it out. Sessions logged in with a password are left alone.
"""

import logging
import os

from django.contrib.auth import get_user_model, login, logout
from django.core.exceptions import MiddlewareNotUsed
from django.utils.crypto import constant_time_compare

logger = logging.getLogger("dsmrreader")

TOKEN_HEADER = "HTTP_X_DSMR_ADDON_INGRESS_TOKEN"
USER_ID_HEADER = "HTTP_X_REMOTE_USER_ID"
USER_NAME_HEADER = "HTTP_X_REMOTE_USER_NAME"
USER_GROUPS_HEADER = "HTTP_X_REMOTE_USER_GROUPS"
ADMIN_GROUP = "system-admin"
# The Home Assistant user a session was logged in for; absent in sessions logged in with a password.
SESSION_KEY = "addon_ingress_user_id"


class IngressAutoLoginMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.token = os.environ.get("DSMRREADER_ADDON_INGRESS_TOKEN", "")
        self.username = os.environ.get("DSMRREADER_ADMIN_USER", "")
        if not self.token or not self.username:
            raise MiddlewareNotUsed()

    def __call__(self, request):
        admin_id = self._home_assistant_admin_id(request)

        logged_in_for = request.session.get(SESSION_KEY) if request.user.is_authenticated else None
        if logged_in_for is not None and logged_in_for != admin_id:
            logout(request)
            logger.info("Ingress auto-login: logged out the session of Home Assistant user %s", logged_in_for)

        if not request.user.is_authenticated and admin_id is not None:
            user = get_user_model().objects.filter(username=self.username, is_active=True).first()
            if user is None:
                logger.warning("Ingress auto-login: user %s does not exist", self.username)
            else:
                login(request, user, backend="django.contrib.auth.backends.ModelBackend")
                request.session[SESSION_KEY] = admin_id
                logger.info(
                    "Ingress auto-login: Home Assistant user %s logged in as %s",
                    request.META.get(USER_NAME_HEADER, admin_id),
                    self.username,
                )
        return self.get_response(request)

    def _home_assistant_admin_id(self, request):
        """The ID of the Home Assistant admin of an Ingress request, None for anyone else."""
        if not constant_time_compare(request.META.get(TOKEN_HEADER, ""), self.token):
            return None
        user_id = request.META.get(USER_ID_HEADER)
        if not user_id:
            return None
        groups = request.META.get(USER_GROUPS_HEADER, "").split(",")
        return user_id if ADMIN_GROUP in (group.strip() for group in groups) else None
