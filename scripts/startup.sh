#!/bin/zsh

# SHUKU ASSETS | PRODUCTION-GRADE STARTUP ENGINE
# Specifically tuned for macOS LaunchAgents and Apple Silicon

# 1. EXPANDED PATH DETECTION
# We force-inject all common paths to ensure Node and Docker are found in non-interactive shells
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Load NVM (Node Version Manager) if the user has it installed
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Source shell profiles to pick up any custom environment variables
[[ -s "$HOME/.zshrc" ]] && source "$HOME/.zshrc"
[[ -s "$HOME/.bash_profile" ]] && source "$HOME/.bash_profile"

LOG_FILE="/tmp/shuku_boot.log"
FE_LOG="/tmp/shuku_frontend.log"

echo "------------------------------------------" >> $LOG_FILE
echo "$(date): 🚀 SHUKU BOOT SEQUENCE START" >> $LOG_FILE

# 2. NAVIGATE & VERIFY
cd "$(dirname "$0")/.."
echo "$(date): 📂 Root: $(pwd)" >> $LOG_FILE

NPM_PATH=$(command -v npm)
if [[ -z "$NPM_PATH" ]]; then
  echo "$(date): ❌ CRITICAL: 'npm' command not found. Path is: $PATH" >> $LOG_FILE
  exit 1
fi

# 3. DOCKER WAKE-UP
if (! docker info > /dev/null 2>&1); then
  echo "$(date): 🐳 Docker is sleeping. Launching engine..." >> $LOG_FILE
  open -a "Docker"
  # Wait up to 60 seconds for Docker to be ready
  for i in {1..12}; do
    sleep 5
    if docker info > /dev/null 2>&1; then
      echo "$(date): ✅ Docker is online." >> $LOG_FILE
      break
    fi
    if [ $i -eq 12 ]; then
      echo "$(date): ❌ Docker timeout." >> $LOG_FILE
      exit 1
    fi
  done
fi

# 4. BACKEND (SUPABASE)
echo "$(date): 📦 Booting Supabase Postgres..." >> $LOG_FILE
# Use npx to ensure we use the local version if available
npx supabase start >> $LOG_FILE 2>&1

# 5. FRONTEND (VITE)
# Check if port 5173 is already in use
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "$(date): 🌐 Frontend already active on 5173." >> $LOG_FILE
else
    echo "$(date): 🌐 Starting Vite Dev Server..." >> $LOG_FILE
    # Start npm run dev, detach from parent, and ensure it stays alive
    # 'disown' is crucial in zsh to stop the shell from killing children on exit
    (npm run dev -- --host >> $FE_LOG 2>&1 &)
    disown
    echo "$(date): ✅ Frontend process detached." >> $LOG_FILE
fi

# 6. FINALIZING
sleep 10
echo "$(date): ✨ Sequence Complete. Launching portal..." >> $LOG_FILE
open "http://localhost:5173" >> $LOG_FILE 2>&1
