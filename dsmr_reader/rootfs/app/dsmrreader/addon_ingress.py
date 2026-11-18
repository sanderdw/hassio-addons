"""
Logs Home Assistant admins in to DSMR Reader when they open it through Ingress.

Home Assistant's Supervisor sends the user of an Ingress request in X-Remote-User-* headers and
drops headers of the same name that a browser sends. The app's web interface is also reachable on
its own port, where a browser could send these headers itself. So only the Ingress server of nginx
(which accepts only the Supervisor) adds a token that the app makes at each start, and this
middleware trusts the user headers only next to that token.
"""

import logging
import os

from django.contrib.auth import get_user_model, login
from django.core.exceptions import MiddlewareNotUsed
from django.utils.crypto import constant_time_compare

logger = logging.getLogger("dsmrreader")

TOKEN_HEADER = "HTTP_X_DSMR_ADDON_INGRESS_TOKEN"
USER_ID_HEADER = "HTTP_X_REMOTE_USER_ID"
USER_NAME_HEADER = "HTTP_X_REMOTE_USER_NAME"
USER_GROUPS_HEADER = "HTTP_X_REMOTE_USER_GROUPS"
ADMIN_GROUP = "system-admin"


class IngressAutoLoginMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.token = os.environ.get("DSMRREADER_ADDON_INGRESS_TOKEN", "")
        self.username = os.environ.get("DSMRREADER_ADMIN_USER", "")
        if not self.token or not self.username:
            raise MiddlewareNotUsed()

    def __call__(self, request):
        if not request.user.is_authenticated and self._is_home_assistant_admin(request):
            user = get_user_model().objects.filter(username=self.username, is_active=True).first()
            if user is None:
                logger.warning("Ingress auto-login: user %s does not exist", self.username)
            else:
                login(request, user, backend="django.contrib.auth.backends.ModelBackend")
                logger.info(
                    "Ingress auto-login: Home Assistant user %s logged in as %s",
                    request.META.get(USER_NAME_HEADER, request.META[USER_ID_HEADER]),
                    self.username,
                )
        return self.get_response(request)

    def _is_home_assistant_admin(self, request):
        if not constant_time_compare(request.META.get(TOKEN_HEADER, ""), self.token):
            return False
        if not request.META.get(USER_ID_HEADER):
            return False
        groups = request.META.get(USER_GROUPS_HEADER, "").split(",")
        return ADMIN_GROUP in (group.strip() for group in groups)
