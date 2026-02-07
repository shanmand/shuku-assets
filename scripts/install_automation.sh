#!/bin/zsh

# SHUKU ASSETS | MAC AUTOMATION INSTALLER
# Run this once to register the app as a system startup service.

# 1. Resolve Absolute Paths
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
PLIST_FILE="$HOME/Library/LaunchAgents/com.shuku.assets.plist"

echo "🛠️  Starting Installation..."
echo "📂 Project Path: $PROJECT_ROOT"

# 2. Ensure Executability
chmod +x "$SCRIPT_DIR/startup.sh"

# 3. Write the Plist
# We use a simple heredoc to create a valid macOS service definition
cat > "$PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.shuku.assets</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>$PROJECT_ROOT/scripts/startup.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>$PROJECT_ROOT</string>
</dict>
</plist>
EOF

# 4. Register with System
echo "🚀 Loading service into launchctl..."
launchctl unload "$PLIST_FILE" 2>/dev/null
launchctl load "$PLIST_FILE"

echo "✅  SUCCESS! The app will now start automatically when you log in."
echo "📝  Check /tmp/shuku_boot.log for activity."
