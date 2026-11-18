"""
Django settings of the Home Assistant app with Ingress auto-login: DSMR Reader's production
settings plus the middleware that logs Home Assistant admins in. The app sets
DJANGO_SETTINGS_MODULE to this module only when Ingress auto-login is on.
"""

from dsmrreader.config.production import *  # noqa: F401,F403
from dsmrreader.config.production import MIDDLEWARE

MIDDLEWARE = list(MIDDLEWARE)
MIDDLEWARE.insert(
    MIDDLEWARE.index("django.contrib.auth.middleware.AuthenticationMiddleware") + 1,
    "dsmrreader.addon_ingress.IngressAutoLoginMiddleware",
)
