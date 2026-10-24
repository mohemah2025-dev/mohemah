#!/usr/bin/env python3
"""Prints --dart-define flags with the Firebase settings of one app, read from mobile/firebase/.

Usage: python3 tool/firebase_defines.py <customer|provider> <android|ios>

Files (downloaded from the Firebase console, project settings):
  mobile/firebase/google-services.json                 Android (one file lists both apps)
  mobile/firebase/GoogleService-Info-customer.plist    iOS, app sa.mohemah.app
  mobile/firebase/GoogleService-Info-provider.plist    iOS, app sa.mohemah.partner
Prints nothing when the files are missing (push stays disabled).
"""
import json
import pathlib
import plistlib
import sys

IDS = {"customer": "sa.mohemah.app", "provider": "sa.mohemah.partner"}
root = pathlib.Path(__file__).resolve().parent.parent / "firebase"
app, platform = sys.argv[1], sys.argv[2]
values = {}

if platform == "android":
    f = root / "google-services.json"
    if f.exists():
        data = json.loads(f.read_text(encoding="utf-8"))
        info = data["project_info"]
        for client in data.get("client", []):
            ci = client["client_info"]
            if ci.get("android_client_info", {}).get("package_name") == IDS[app]:
                values = {
                    "FB_API_KEY": client["api_key"][0]["current_key"],
                    "FB_APP_ID": ci["mobilesdk_app_id"],
                    "FB_SENDER_ID": info["project_number"],
                    "FB_PROJECT_ID": info["project_id"],
                }
        if not values:
            print(f"warning: {IDS[app]} not found in google-services.json", file=sys.stderr)
else:
    f = root / f"GoogleService-Info-{app}.plist"
    if f.exists():
        p = plistlib.loads(f.read_bytes())
        values = {
            "FB_API_KEY": p["API_KEY"],
            "FB_APP_ID": p["GOOGLE_APP_ID"],
            "FB_SENDER_ID": p["GCM_SENDER_ID"],
            "FB_PROJECT_ID": p["PROJECT_ID"],
            "FB_IOS_BUNDLE_ID": p.get("BUNDLE_ID", IDS[app]),
        }

print(" ".join(f"--dart-define={k}={v}" for k, v in values.items()))
if not values:
    print(f"note: Firebase settings for {app}/{platform} not found — push disabled in this build", file=sys.stderr)
