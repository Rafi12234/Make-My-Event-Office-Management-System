# Make My Event Mobile App — iOS Development from Windows

## Purpose

This guide explains how to continue developing the existing **Make My Event** mobile application for **iOS** while working under these conditions:

- Windows PC only
- Android phone available for daily testing
- No Mac
- No iPhone
- No paid Apple Developer account
- Keep the existing technology stack
- Use the same backend and database
- Build the iOS version through Expo EAS Cloud
- Test the iOS build later using a temporary/cloud Mac and Apple iOS Simulator

The technology remains unchanged:

```text
React Native
Expo
Expo Router
JavaScript
TanStack Query
Expo SecureStore
Expo Image Picker
@react-native-community/datetimepicker
Node.js + Express
Prisma
MySQL / MariaDB
```

You do **not** need Swift, SwiftUI, Objective-C, Flutter, Ionic, a second backend, or a second database.

---

# Overall Workflow

```text
Windows PC
    │
    │ Develop React Native + Expo
    │
    ├──────────────► Android Phone
    │                 Daily testing
    │
    ▼
Expo EAS Cloud
    │
    │ macOS + Xcode cloud compilation
    ▼
iOS Simulator Build (.app)
    │
    ▼
Temporary / Cloud Mac
    │
    ▼
Apple iOS Simulator
    │
    ▼
Make My Event iOS testing
    │
    ▼
Same Hosted Express API
    │
    ▼
Prisma
    │
    ▼
MySQL
```

---

# CHUNK 0 — Understand the Current Limitations

## You can do now

- Develop the complete shared React Native application on Windows.
- Test most features on Android.
- Configure the same project for iOS.
- Compile a real iOS Simulator application using EAS Cloud.
- Build iOS from Windows.
- Avoid paid Apple Developer membership for simulator development.
- Later run the build on a Cloud Mac with Apple's real Simulator.

## You cannot do yet

Without a paid Apple Developer account and access to a physical iPhone, this workflow does not provide:

```text
TestFlight
App Store distribution
Normal production iPhone installation
Normal EAS physical-device signing
Permanent installation on a real iPhone
```

The development goal is:

```text
Windows development
      ↓
Android daily testing
      ↓
EAS iOS Simulator build
      ↓
Cloud Mac + Apple Simulator testing
```

---

# CHUNK 1 — Open the Existing Mobile Project

Expected repository structure:

```text
Make-My-Event-Office-Management-System-MobileApp/
│
├── backend/
├── frontend/
└── mobile/
    ├── app/
    ├── components/
    ├── constants/
    ├── context/
    ├── hooks/
    ├── providers/
    ├── services/
    ├── utils/
    ├── app.json
    ├── eas.json
    ├── package.json
    └── ...
```

Open the project in VS Code and move into the mobile directory:

```powershell
cd mobile
```

Confirm:

```powershell
dir
```

You should see files such as:

```text
package.json
app.json
app/
components/
services/
```

### Checkpoint

Do not continue until the terminal is inside the `mobile` directory.

---

# CHUNK 2 — Verify Node.js and npm

Run:

```powershell
node -v
npm -v
```

You should receive version numbers.

If Windows says Node is not recognized, install Node.js LTS, restart VS Code, and run the commands again.

---

# CHUNK 3 — Install Existing Dependencies

Inside `mobile/`:

```powershell
npm install
```

Warnings do not automatically mean the project is broken.

Do **not** randomly run commands such as:

```text
npm update
npm audit fix --force
```

on an existing Expo project without first checking compatibility.

---

# CHUNK 4 — Verify Android Before iOS Work

Run:

```powershell
npx expo start
```

Open Expo Go on the Android phone and scan the QR code.

Test:

```text
Login
Dashboard
Clients
Client details
Calls
Meetings
Requirement items
Image selection
Logout
```

If LAN connection is difficult:

```powershell
npx expo start --tunnel
```

Stop Metro when finished:

```text
Ctrl + C
```

### Why this matters

If Android is already broken, fix it before introducing iOS configuration so an existing issue is not mistaken for an iOS issue.

---

# CHUNK 5 — Run Expo Doctor

Run:

```powershell
npx expo-doctor@latest
```

Expo Doctor checks:

- Expo SDK compatibility
- React Native dependency compatibility
- Project configuration
- Native module compatibility
- Common Expo setup issues

When correcting Expo packages, prefer:

```powershell
npx expo install <package-name>
```

instead of manually choosing random versions.

### Checkpoint

Resolve blocking compatibility errors before continuing.

---

# CHUNK 6 — Install Expo Development Client

Run:

```powershell
npx expo install expo-dev-client
```

After installation, `package.json` should contain an `expo-dev-client` dependency.

### Important Windows rule

Do not run:

```text
pod install
```

and do not try to manage CocoaPods locally on Windows. EAS Cloud handles native iOS generation, CocoaPods, and Xcode compilation on macOS.

---

# CHUNK 7 — Configure iOS in `app.json`

Open:

```text
mobile/app.json
```

Do **not** replace the entire existing file. Preserve Android settings, icons, splash, plugins, scheme, and any project-specific configuration.

Make sure the `expo` object contains an iOS section similar to:

```json
{
  "expo": {
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.makemyevent.mobile",
      "config": {
        "usesNonExemptEncryption": false
      }
    }
  }
}
```

The important identifier is:

```text
com.makemyevent.mobile
```

Do not add a second `ios` object if one already exists.

---

# CHUNK 8 — Configure iOS Photos Permission

The application uses the gallery for meeting/requirement images.

If `expo-image-picker` already exists in `plugins`, edit that existing entry rather than adding a duplicate.

Example:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow Make My Event to access photos for event and meeting requirement images."
        }
      ]
    ]
  }
}
```

---

# CHUNK 9 — Verify Expo Configuration

Run:

```powershell
npx expo config
```

Confirm Expo sees:

```text
ios.bundleIdentifier = com.makemyevent.mobile
```

You can also run:

```powershell
npx expo config --type public
```

### Checkpoint

Do not start the cloud build until Expo correctly recognizes the iOS configuration.

---

# CHUNK 10 — Verify the Backend API URL

A remote iOS Simulator cannot access your Windows `localhost`.

Do not use:

```text
http://localhost:...
http://127.0.0.1:...
http://192.168.x.x:...
```

for Cloud Mac testing.

Use the hosted HTTPS API, for example:

```text
https://mme-office.datapulseglobal.com/api
```

Architecture:

```text
Android Phone ─────┐
                   │
                   ▼
             Hosted Express API
                   │
                 Prisma
                   │
                 MySQL
                   ▲
                   │
iOS Simulator ─────┘
```

Both Android and iOS should use the same backend and database.

---

# CHUNK 11 — Create or Use an Expo Account

You need an Expo account for EAS Cloud Build.

For this iOS **Simulator** workflow, the Expo account is enough for building. A paid Apple Developer membership is not required for this simulator-targeted development stage.

You will use Expo for:

```text
EAS project
Cloud builds
Build history
Build artifacts
```

---

# CHUNK 12 — Install EAS CLI

Run:

```powershell
npm install --global eas-cli
```

Verify:

```powershell
eas --version
```

If `eas` is not recognized, close and reopen the terminal, then try again.

---

# CHUNK 13 — Login to Expo

Run:

```powershell
eas login
```

Then verify:

```powershell
eas whoami
```

The command should print the Expo account you intend to use.

---

# CHUNK 14 — Connect the Existing Project to EAS

Inside `mobile/`:

```powershell
eas build:configure
```

If asked which platforms to configure, choose:

```text
All
```

or at minimum iOS.

EAS may add a project ID to `app.json`, similar to:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  }
}
```

Do not remove that `projectId`.

---

# CHUNK 15 — Configure `eas.json`

Open:

```text
mobile/eas.json
```

A suitable setup is:

```json
{
  "cli": {
    "version": ">= 16.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "ios-simulator": {
      "extends": "development",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

The critical section is:

```json
"ios-simulator": {
  "extends": "development",
  "ios": {
    "simulator": true
  }
}
```

This means:

```text
Build for Apple iOS Simulator
NOT for a physical iPhone
```

If `eas.json` already contains Android configuration, merge this profile into the existing file instead of deleting working settings.

---

# CHUNK 16 — Understand the Artifact

```text
Android physical device
        ↓
       APK

Physical iPhone
        ↓
       IPA

iOS Simulator
        ↓
       .app
```

Your current target is an iOS Simulator `.app` build.

It is not a TestFlight or App Store package and is not intended for direct installation on a physical iPhone.

---

# CHUNK 17 — Build the First iOS Simulator Version

From `mobile/`:

```powershell
eas build --platform ios --profile ios-simulator
```

Short form:

```powershell
eas build -p ios --profile ios-simulator
```

The build flow is:

```text
Windows
   │
   │ Upload source
   ▼
Expo EAS
   │
   ▼
Cloud macOS builder
   │
   ▼
Install dependencies
   │
   ▼
Expo native generation
   │
   ▼
CocoaPods
   │
   ▼
Xcode
   │
   ▼
React Native iOS compilation
   │
   ▼
iOS Simulator .app
```

Your Windows PC never needs to run Xcode.

---

# CHUNK 18 — Handle First-Build Questions

## Bundle identifier

If EAS asks for an iOS bundle identifier, enter:

```text
com.makemyevent.mobile
```

## Encryption

Keep the answer/configuration consistent with:

```json
"usesNonExemptEncryption": false
```

for the current app, which uses standard platform HTTPS/SecureStore rather than custom cryptographic implementation.

## Apple Developer login

For a simulator-targeted build using:

```json
"ios": {
  "simulator": true
}
```

normal physical-device Apple signing is not the goal of this build.

---

# CHUNK 19 — Monitor the EAS Build

Typical output:

```text
Compressing project files
Uploading to EAS Build
Build queued
Build in progress
```

EAS provides a browser URL where you can see stages such as:

```text
Queue
 ↓
Prepare project
 ↓
Install dependencies
 ↓
Prebuild
 ↓
Install CocoaPods
 ↓
Xcode build
 ↓
Bundle JavaScript
 ↓
Create artifact
```

### Milestone 1

You want:

```text
Build finished / SUCCESS
```

At this point you have successfully compiled the iOS version from Windows.

---

# CHUNK 20 — Do Not Try to Run the Simulator on Windows

A successful `.app` build cannot run directly on Windows.

This will not work:

```text
Windows
  ↓
Download .app
  ↓
Double-click
  ↓
iPhone Simulator
```

Apple's official iOS Simulator is part of Xcode and requires macOS.

If EAS asks whether to install/run the build in an iOS Simulator while you are still on Windows, choose **No**.

---

# CHUNK 21 — View Existing iOS Builds

Run:

```powershell
eas build:list --platform ios
```

Use this to confirm the latest simulator build is successful before paying for Cloud Mac access.

---

# CHUNK 22 — Do Not Rent a Cloud Mac Before Build Success

First achieve:

```text
Windows
  ↓
EAS
  ↓
iOS Simulator Build
  ↓
SUCCESS
```

Only then move to remote macOS testing.

This avoids paying for Mac time while debugging EAS configuration or dependency problems.

---

# CHUNK 23 — Prepare a Temporary / Cloud Mac

Choose a remote Mac environment that provides:

```text
macOS
Xcode
Apple iOS Simulator
Remote desktop access
Internet access
```

You do not need a Cloud Mac for daily development.

Recommended usage:

```text
Daily development
   ↓
Windows + Android

Feature/sprint complete
   ↓
EAS iOS build

Need iOS validation
   ↓
Use Cloud Mac briefly
```

---

# CHUNK 24 — Verify Xcode on the Cloud Mac

Open Terminal on the remote Mac:

```bash
xcodebuild -version
```

Then open Apple's Simulator from Xcode:

```text
Xcode
  ↓
Open Developer Tool
  ↓
Simulator
```

Choose an available simulated iPhone model.

---

# CHUNK 25 — Login to EAS on the Cloud Mac

Install EAS CLI if necessary:

```bash
npm install --global eas-cli
```

Login:

```bash
eas login
```

Verify:

```bash
eas whoami
```

Use the same Expo account used on Windows.

---

# CHUNK 26 — Install the Latest Simulator Build

Keep Apple Simulator open.

Run on the Cloud Mac:

```bash
eas build:run -p ios --latest
```

The flow is:

```text
EAS build artifact
       ↓
Cloud Mac
       ↓
Apple Simulator
       ↓
Make My Event Development Build
```

---

# CHUNK 27 — Start Metro from Windows

Because the build is a development client, it can load the latest JavaScript bundle from Metro.

On Windows:

```powershell
cd mobile
npx expo start --dev-client --tunnel
```

`--tunnel` is important because the Windows PC and Cloud Mac are on different networks.

---

# CHUNK 28 — Connect the iOS Development Client

The iOS development build may initially show a development launcher.

This is normal.

```text
Development Client
      ↓
Launcher
      ↓
Connect to Metro
      ↓
Download JS bundle
      ↓
Run Make My Event
```

If automatic discovery does not work, use the development client's manual URL option and enter the tunnel URL shown by the Windows Metro terminal.

---

# CHUNK 29 — Final Running Architecture

```text
                     WINDOWS PC

                      VS Code
                         │
                 React Native source
                         │
                 Metro Dev Server
                         │
                      Tunnel
                         │
                         ▼
                    CLOUD MAC
                         │
                         ▼
                  iOS Simulator
                         │
                         ▼
                 Make My Event
                         │
                         │ HTTPS
                         ▼
               Hosted Express API
                         │
                       Prisma
                         │
                       MySQL
```

Android can continue using the same API simultaneously.

---

# CHUNK 30 — First iOS Testing Order

Test systematically.

## 1. Startup

```text
App launches
No native crash
Correct splash/icon
Correct initial route
```

## 2. Login

```text
Input layout
Keyboard
Password field
Login button
Loading state
API request
```

## 3. Authentication

```text
Successful login
Invalid credentials
Secure token storage
Authenticated routing
Logout
```

## 4. Dashboard

```text
Today's calls
Today's meetings
Upcoming calls
Upcoming meetings
Overdue data
Refresh behavior
```

## 5. Clients

```text
Client list
Search
Client detail
Create client
Delete client
```

## 6. Calls

```text
History
Create
Discussion
Next call date/time
Assignment
Edit
Delete
```

## 7. Meetings

```text
History
Create
Requirement items
Description
Quantity
Assignment
Next meeting
Completion
Delete
```

## 8. Images

```text
Permission
Gallery
Select image
FormData
Upload
Display
```

## 9. Session restoration

```text
Login
Close app
Reopen app
Restore session correctly
Logout
```

---

# CHUNK 31 — Fix the Existing Mobile Authentication Issue Before Serious iOS Testing

The project analysis found an important mobile authentication mismatch.

The mobile app saves the Bearer JWT and later calls:

```text
GET /api/employees/me
```

for session restoration.

However, the current backend employee route uses cookie-oriented employee authentication, while Bearer-token adaptation is applied to several other mobile-accessible route groups.

Possible failure:

```text
Login succeeds
    ↓
Token saved
    ↓
App closed
    ↓
App reopened
    ↓
GET /employees/me
    ↓
401
    ↓
User appears logged out
```

Fix this before using app-restart behavior as an iOS acceptance test.

Also make sure a `401` clears both:

```text
SecureStore token
AND
AuthContext employee state
```

---

# CHUNK 32 — Check iOS Safe Areas

Check the top area around a notch/Dynamic Island and the bottom home indicator.

Verify:

```text
Headers
Tab bar
Floating actions
Bottom buttons
Modals
Scroll content
```

Important UI should never sit underneath system areas.

---

# CHUNK 33 — Check Keyboard Behavior

Test text inputs on iOS:

```text
Login email/password
Client form
Call discussion
Meeting description
Requirement description
```

Look for:

```text
Input hidden by keyboard
Button hidden by keyboard
Unexpected layout jump
No way to dismiss keyboard
```

---

# CHUNK 34 — Test Native Date/Time Picker

The app uses:

```text
@react-native-community/datetimepicker
```

Android and iOS render it differently.

Test:

```text
Client event date
Next call date
Next call time
Next meeting date
Next meeting time
```

Check the selected value, display, timezone, request payload, and saved backend value.

---

# CHUNK 35 — Test Image Picker Carefully

The app uses `expo-image-picker`.

Test:

```text
Meeting
  ↓
Requirement
  ↓
Choose image
  ↓
Photo permission
  ↓
Gallery
  ↓
Select
  ↓
Upload
```

Verify:

```text
Permission message
Selection
Preview
MIME type
FormData
Upload
Server response
Image display
```

### HEIC / HEIF warning

Real iPhones commonly use HEIC/HEIF images while the backend mainly allows JPEG, PNG, GIF, and WEBP. Simulator testing is useful, but physical-iPhone image testing is still recommended before production.

---

# CHUNK 36 — Test SecureStore

Test:

```text
Login
  ↓
Token stored
  ↓
Navigate
  ↓
Close/relaunch
  ↓
Session restored
```

Then:

```text
Logout
  ↓
Token removed
  ↓
Return to login
```

---

# CHUNK 37 — Test Phone Links

The Client Detail screen uses `tel:`.

The Simulator cannot reproduce real cellular calling, but confirm that tapping the call action does not crash the application.

Real phone behavior requires a physical iPhone later.

---

# CHUNK 38 — Daily Development Workflow

Most days stay on Windows.

```powershell
npx expo start
```

Test on Android.

Develop shared features normally:

```text
Screens
Forms
Components
API calls
Validation
Business logic
Navigation
TanStack Query
State management
```

Do not create a new iOS native build for every small JS/style change.

---

# CHUNK 39 — When to Create a New iOS Simulator Build

Create a new native build after changes such as:

```text
Add/remove native library
Change Expo plugins
Change iOS permissions
Change native app.json configuration
Change Expo SDK
Change React Native version
Change native scheme/configuration
```

Then run:

```powershell
eas build -p ios --profile ios-simulator
```

Normal JavaScript changes usually do not require a new native build:

```text
Button text
JSX
Styles
API calls
Business logic
Validation
TanStack Query
Hooks
Utilities
```

---

# CHUNK 40 — Recommended Sprint Workflow

```text
DAILY
Windows coding
   ↓
Android testing
   ↓
Fix
   ↓
Repeat
```

At the end of an important feature/sprint:

```text
Feature stable
    ↓
Expo Doctor
    ↓
EAS iOS Simulator build
    ↓
Build success
    ↓
Cloud Mac
    ↓
iOS Simulator regression test
    ↓
Record iOS bugs
    ↓
Fix from Windows
```

This minimizes Cloud Mac cost.

---

# CHUNK 41 — Do Not Manually Maintain Native iOS Files Yet

Avoid unnecessary native maintenance such as:

```text
Manually creating ios/
Editing Xcode project manually
Editing Podfile from Windows
Installing CocoaPods on Windows
Writing Swift for ordinary shared features
```

Keep the Expo-managed project as the source of truth.

EAS handles:

```text
Expo config
   ↓
Native iOS generation
   ↓
Pods
   ↓
Xcode
   ↓
Build
```

---

# CHUNK 42 — Keep One Shared Codebase

Do not split into:

```text
mobile-android/
mobile-ios/
```

unless a future requirement truly demands separate native codebases.

Use the existing:

```text
mobile/
```

When platform-specific behavior is genuinely necessary:

```javascript
import { Platform } from "react-native";

if (Platform.OS === "ios") {
  // iOS-specific behavior
}
```

or platform-specific files:

```text
Component.android.jsx
Component.ios.jsx
```

Use these only where needed.

---

# CHUNK 43 — Keep One Backend and Database

Do not create a separate iOS backend.

```text
Android ─────┐
             │
             ▼
          Express
             │
           Prisma
             │
           MySQL
             ▲
             │
iOS ─────────┘
```

Mobile authentication continues to use:

```http
Authorization: Bearer <JWT>
```

---

# CHUNK 44 — Existing Project Issues to Prioritize

Before serious cross-platform testing, prioritize these known issues from the repository analysis.

## Critical

1. Fix Bearer authentication for `GET /api/employees/me`.
2. Clear both token and AuthContext employee state when the JWT expires.
3. Stop trusting `req.body.employeeId` for workspace audit identity.
4. Enforce mandatory password change from the backend/mobile, not only web UI.
5. Add ownership/authorization checks to manual calendar update/delete.

## Mobile workflow issues

6. Editing an existing call with no next call should not automatically create one.
7. Editing an existing meeting with no next meeting should not automatically create one.
8. Resolve mobile meeting creation conflict with backend copy-forward.
9. Reduce partial meeting creation caused by multiple independent API requests.
10. Verify iOS date parsing and timezone behavior.

Fixing these improves both Android and iOS.

---

# CHUNK 45 — Troubleshooting: `eas` Not Recognized

Run:

```powershell
npm install --global eas-cli
```

Restart the terminal.

Then:

```powershell
eas --version
```

If necessary:

```powershell
npx eas-cli --version
```

---

# CHUNK 46 — Troubleshooting: Expo Dependency Errors

Run:

```powershell
npx expo-doctor@latest
```

Prefer:

```powershell
npx expo install <package>
```

for Expo-managed/native dependencies.

Do not randomly force package upgrades.

---

# CHUNK 47 — Troubleshooting: EAS Fails During npm Install

Check:

```text
package.json
package-lock.json
Node version
Dependency conflicts
```

Run locally:

```powershell
npm install
npx expo-doctor@latest
```

Fix local dependency errors before submitting another cloud build.

---

# CHUNK 48 — Troubleshooting: EAS Fails During Prebuild

Common causes:

```text
Invalid app.json
Duplicate plugins
Unsupported plugin configuration
Broken native dependency
Missing required configuration
```

Check:

```powershell
npx expo config
```

Then inspect the EAS build log around the Prebuild step.

---

# CHUNK 49 — Troubleshooting: iOS Cannot Reach Backend

Check that the mobile app is not using:

```text
localhost
127.0.0.1
192.168.x.x
```

The Cloud Mac/iOS Simulator needs a publicly reachable HTTPS backend.

Also verify the backend TLS certificate is valid.

---

# CHUNK 50 — Troubleshooting: Development Client Cannot Find Metro

From Windows:

```powershell
npx expo start --dev-client --tunnel
```

Do not rely on LAN discovery between Windows and a remote Mac.

Use the development client's manual URL entry if automatic discovery fails.

---

# CHUNK 51 — Troubleshooting: iOS Image Upload Fails

Check:

```text
Photo permission
Asset MIME type
Filename extension
FormData
Backend MIME whitelist
File size
File count
```

Current backend behavior identified during analysis includes approximately:

```text
JPEG
PNG
GIF
WEBP
8 MB per image
10 files maximum
```

Also check HEIC/HEIF behavior.

---

# CHUNK 52 — Troubleshooting: Date/Time Is Wrong

The backend uses Dhaka business time:

```text
Asia/Dhaka
UTC+6
```

Avoid relying on ambiguous date strings such as:

```text
2026-08-22 15:30:00
```

for cross-platform JavaScript parsing.

Prefer ISO-like values:

```text
2026-08-22T15:30:00
```

or explicit parsing.

Test carefully on iOS/Hermes.

---

# CHUNK 53 — Troubleshooting: Layout Looks Different on iOS

Check:

```text
SafeAreaView
paddingTop
paddingBottom
StatusBar
KeyboardAvoidingView
ScrollView
Tab bar height
Modal presentation
Font weight
Line height
```

Avoid hard-coded dimensions based only on one Android device.

---

# CHUNK 54 — What the iOS Simulator Tests Well

The Simulator is useful for:

```text
Screen layout
Navigation
Safe areas
Keyboard behavior
Forms
API calls
Login
JWT logic
SecureStore behavior
Date picker behavior
React Native rendering
Modals
Scrolling
General image-picker flow
```

---

# CHUNK 55 — What Still Needs a Real iPhone Before Production

The Simulator cannot fully reproduce:

```text
Real camera
Real cellular network
Actual phone calls
Real-device performance
Push notifications
Background restrictions
Hardware memory pressure
Real Photos library behavior
HEIC camera workflow
Some permissions
Physical-device-only native behavior
```

A physical iPhone is not required for daily development, but access to at least one real iPhone is strongly recommended before production release.

---

# CHUNK 56 — Future Production Path

When the company is ready for actual iPhone users:

```text
Finished React Native app
        ↓
Physical iPhone testing
        ↓
Apple Developer Program
        ↓
EAS Production iOS Build
        ↓
App Store Connect
        ↓
TestFlight
        ↓
Internal / External testers
        ↓
App Store / company distribution
```

The application does **not** need to be rewritten at that point. Only signing and distribution change.

---

# CHUNK 57 — Immediate Windows Command Checklist

```powershell
cd mobile
```

```powershell
npm install
```

```powershell
npx expo-doctor@latest
```

```powershell
npx expo install expo-dev-client
```

Check/edit:

```text
app.json
```

Then:

```powershell
npx expo config
```

Install EAS:

```powershell
npm install --global eas-cli
```

Login:

```powershell
eas login
```

Verify:

```powershell
eas whoami
```

Configure:

```powershell
eas build:configure
```

Add to `eas.json`:

```json
"ios-simulator": {
  "extends": "development",
  "ios": {
    "simulator": true
  }
}
```

Build:

```powershell
eas build --platform ios --profile ios-simulator
```

---

# CHUNK 58 — Milestone 1 Checklist: EAS Build

- [ ] Existing Android app works.
- [ ] `npm install` succeeds.
- [ ] Expo Doctor has no blocking error.
- [ ] `expo-dev-client` is installed.
- [ ] `app.json` has iOS configuration.
- [ ] Bundle ID is `com.makemyevent.mobile`.
- [ ] Image Picker has iOS permission text.
- [ ] Mobile uses hosted HTTPS backend.
- [ ] EAS CLI is installed.
- [ ] Expo login works.
- [ ] `eas whoami` works.
- [ ] Project is linked to EAS.
- [ ] `eas.json` contains `ios-simulator`.
- [ ] `ios.simulator` is `true`.
- [ ] EAS simulator build finishes successfully.

Do not proceed to Cloud Mac before this milestone is complete.

---

# CHUNK 59 — Milestone 2 Checklist: Cloud Mac

- [ ] Cloud Mac has Xcode.
- [ ] Apple iOS Simulator is installed.
- [ ] Simulator opens.
- [ ] EAS CLI is installed on the Mac.
- [ ] Same Expo account is logged in.
- [ ] Latest simulator build is installed.
- [ ] Windows Metro starts with `--dev-client --tunnel`.
- [ ] iOS development client connects to Metro.
- [ ] Make My Event opens in the iOS Simulator.

---

# CHUNK 60 — Milestone 3 Checklist: iOS Feature Validation

- [ ] App opens without native crash.
- [ ] Login layout is correct.
- [ ] Login API works.
- [ ] Bearer JWT authentication works.
- [ ] SecureStore works.
- [ ] Dashboard loads.
- [ ] Client list loads.
- [ ] Search works.
- [ ] Client detail displays correctly.
- [ ] Client creation works.
- [ ] Calls work.
- [ ] Next-call picker works.
- [ ] Meetings work.
- [ ] Requirement items work.
- [ ] Next-meeting picker works.
- [ ] Photo permission works.
- [ ] Image Picker works.
- [ ] Image upload works.
- [ ] Safe areas are correct.
- [ ] Keyboard does not cover forms.
- [ ] Date/time values are correct.
- [ ] Logout works.
- [ ] Restart/session restoration works.
- [ ] No Android-only assumption causes an iOS crash.

---

# CHUNK 61 — Working Rule

Use this rule throughout development:

```text
JavaScript / UI / API change
        ↓
Test on Android
        ↓
Usually no new native iOS build
```

But:

```text
Native dependency / config / permission change
        ↓
Create a new EAS iOS Simulator build
```

Periodically:

```text
Stable feature set
      ↓
Cloud Mac
      ↓
iOS Simulator regression test
```

---

# CHUNK 62 — Final Development Strategy

```text
                    ONE CODEBASE

               React Native + Expo
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
       Android                    iOS
          │                         │
Android phone daily         EAS Cloud build
    testing                        │
                                   ▼
                            .app simulator build
                                   │
                                   ▼
                              Cloud Mac
                                   │
                                   ▼
                            Apple Simulator
```

Both platforms continue using:

```text
Same React Native screens/components
Same Expo Router
Same TanStack Query logic
Same SecureStore authentication approach
Same Express backend
Same Prisma layer
Same MySQL database
```

Windows + Android remains the primary development environment.

EAS Cloud provides iOS compilation.

A temporary/cloud Mac provides the genuine Apple Simulator runtime.

No technology-stack rewrite is required.

---

# Final Command Summary

## Windows — normal development

```powershell
cd mobile
npm install
npx expo start
```

## Windows — health check

```powershell
npx expo-doctor@latest
```

## Windows — development client

```powershell
npx expo install expo-dev-client
```

## Windows — EAS setup

```powershell
npm install --global eas-cli
eas login
eas whoami
eas build:configure
```

## Windows — iOS Simulator build

```powershell
eas build -p ios --profile ios-simulator
```

## Cloud Mac — install/run latest simulator build

```bash
eas build:run -p ios --latest
```

## Windows — serve current code to remote iOS development client

```powershell
npx expo start --dev-client --tunnel
```

---

# End Goal

At the end of this workflow you will have:

```text
Make My Event
React Native + Expo
        │
        ├── Android version
        │     tested on Android phone
        │
        └── iOS version
              compiled by EAS Cloud
              tested in Apple iOS Simulator
```

without buying a Mac or iPhone during the development phase and without changing the existing React Native + Expo technology stack.
