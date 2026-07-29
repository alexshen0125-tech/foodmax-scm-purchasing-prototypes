#!/usr/bin/env bash
# Food Max 前端还原 skill「foodmax-frontend」远程一键安装
# 用法：curl -fsSL https://raw.githubusercontent.com/alexshen0125-tech/foodmax-scm-purchasing-prototypes/main/skills/foodmax-frontend/remote-install.sh | bash          # 项目级(当前git仓 .claude/skills)
#      curl -fsSL https://raw.githubusercontent.com/alexshen0125-tech/foodmax-scm-purchasing-prototypes/main/skills/foodmax-frontend/remote-install.sh | bash -s -- --user   # 个人级(~/.claude/skills)
set -eo pipefail
BASE="https://raw.githubusercontent.com/alexshen0125-tech/foodmax-scm-purchasing-prototypes/main/skills/foodmax-frontend"; NAME="foodmax-frontend"
MODE="project"; [ "${1:-}" = "--user" ] && MODE="user"
if [ "$MODE" = "user" ]; then ROOT="$HOME/.claude/skills"; else ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.claude/skills"; fi
DEST="$ROOT/$NAME"; mkdir -p "$DEST/references"
curl -fsSL "$BASE/SKILL.md" -o "$DEST/SKILL.md"
for f in design-system.css components.md icons.md; do curl -fsSL "$BASE/references/$f" -o "$DEST/references/$f"; done
echo "✅ 已安装 skill「${NAME}」→ ${DEST}"
echo "🔍 在该目录开 Claude Code，输入 /${NAME} 能调起即成功。"
[ "$MODE" = "project" ] && echo "👉 团队共享：git add .claude/skills/${NAME} && git commit -m 'add ${NAME} skill' && git push (若 .claude 被 gitignore 用 -f)"
