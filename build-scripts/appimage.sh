#!/bin/sh
#neo: credits: https://github.com/LCE-Hub/LCE-Emerald-Launcher/blob/main/pkg/AppImage/AppImage.sh
#neo: (which credits: https://github.com/cjonas1999/OverBind/blob/master/pkg/AppImage/AppImage.sh)
set -eu
TARGET="${1:-linux}"
case "$TARGET" in
    linux)       NEU_ARCH="x64"   ;;
    linux-arm64) NEU_ARCH="arm64" ;;
    *) echo "Invalid target: $TARGET" >&2; exit 1;;
esac
APP_NAME="LC-Launcher"
HOST_ARCH="$(uname -m)"
DIST_DIR="dist/linux_${NEU_ARCH}/${APP_NAME}"
if [ ! -f "$DIST_DIR/usr/bin/$APP_NAME" ] || [ ! -f "$DIST_DIR/usr/bin/resources.neu" ]; then
    echo "ERROR: Missing built app at $DIST_DIR, run 'node ./build-scripts/build.js $TARGET' first" >&2
    exit 1
fi
SHARUN_REPO="https://raw.githubusercontent.com/pkgforge-dev/Anylinux-AppImages"
_commits_json=$(mktemp)
wget -qO "$_commits_json" \
    "https://api.github.com/repos/pkgforge-dev/Anylinux-AppImages/commits?path=useful-tools/&per_page=100"

STABLE_SHA=$(node -e "
const data = JSON.parse(require('fs').readFileSync('$_commits_json', 'utf8'));
const now = Date.now(), h24 = 864e5;
for (let i = 0; i < data.length; i++) {
    const t = new Date(data[i].commit.committer.date).getTime();
    if (now - t < h24) continue;
    const prev = data[i - 1];
    if (!prev || new Date(prev.commit.committer.date).getTime() - t >= h24) {
        process.stdout.write(data[i].sha);
        process.exit(0);
    }
}
process.stderr.write('No settled commit found in last 100 commits\n');
process.exit(1);
")
rm -f "$_commits_json"
echo "Pinning sharun scripts to settled commit $STABLE_SHA"
SHARUN="$SHARUN_REPO/$STABLE_SHA/useful-tools/quick-sharun.sh"
DEBLOATED_PKGS="$SHARUN_REPO/$STABLE_SHA/useful-tools/get-debloated-pkgs.sh"
#export UPINFO="gh-releases-zsync|${GITHUB_REPOSITORY%/*}|${GITHUB_REPOSITORY#*/}|latest|*$HOST_ARCH.AppImage.zsync"
export OUTNAME="$APP_NAME-anylinux-$HOST_ARCH.AppImage"
export DESKTOP="/usr/share/applications/$APP_NAME.desktop"
export ICON="/usr/share/icons/hicolor/256x256/apps/$APP_NAME.png"
export DEPLOY_OPENGL=1
rm -rf AppDir appinfo
mkdir -p AppDir
wget --retry-connrefused --tries=30 "$DEBLOATED_PKGS" -O ./get-debloated-pkgs
wget --retry-connrefused --tries=30 "$SHARUN" -O ./quick-sharun
chmod +x ./quick-sharun ./get-debloated-pkgs
./get-debloated-pkgs --add-common --prefer-nano
install -Dm755 "$DIST_DIR/usr/bin/$APP_NAME" "/usr/bin/$APP_NAME"
install -Dm644 "$DIST_DIR/usr/bin/resources.neu" "/usr/bin/resources.neu"
if [ -d "$DIST_DIR/usr/bin/extensions" ]; then cp -r "$DIST_DIR/usr/bin/extensions" /usr/bin/; fi
if [ -d "$DIST_DIR/usr/bin/libs" ]; then cp -r "$DIST_DIR/usr/bin/libs" /usr/bin/; fi
install -Dm644 "$DIST_DIR/$APP_NAME.desktop" "$DESKTOP"
install -Dm644 "$DIST_DIR/$APP_NAME.png" "$ICON"
#neo: Neutralino resolves NL_PATH from the binary location, so the app data must already sit next to the binary in the AppDir before the deploy runs (the LD_DEBUG probe executes the app to find dlopened libs)
mkdir -p AppDir/bin
cp /usr/bin/resources.neu AppDir/bin/
if [ -d /usr/bin/extensions ]; then cp -r /usr/bin/extensions AppDir/bin/; fi
if [ -d /usr/bin/libs ]; then cp -r /usr/bin/libs AppDir/bin/; fi
cat > AppDir/AppRun.sh <<EOF
#!/bin/sh
if [ -z "\$APPDIR" ]; then
APPDIR=\$(readlink -f "\$(dirname "\$0")")
fi
export PATH="\$APPDIR/bin:\$PATH"
# fixes the webkit no window showing up
export WEBKIT_DISABLE_DMABUF_RENDERER=1
# stops double window titlebar
if [ "\$XDG_SESSION_TYPE" = "wayland" ]; then
export GDK_BACKEND=x11
fi
#neo: source the hooks so hardcoded paths patched to /tmp/<randomshit> by quick-sharun get symlinked back into the AppImage (webkit spawns its helper processes by absolute path, so the symlink is required for them to resolve)
if [ -f "\$APPDIR/AppRun.lib" ]; then
. "\$APPDIR/AppRun.lib"
for hook in "\$APPDIR"/bin/*.hook; do
    [ -e "\$hook" ] || continue
    . "\$hook"
done
fi
exec "\$APPDIR/bin/$APP_NAME" "\$@"
EOF
chmod +x AppDir/AppRun.sh
#neo: make sure the strace probe for dlopened libs uses the same webkit env
export WEBKIT_DISABLE_DMABUF_RENDERER=1
./quick-sharun /usr/bin/$APP_NAME
#neo: webkit spawns its helper processes by an absolute path inside lib/webkit2gtk-4.1
#neo: quick-sharun maps it to /tmp/<randomshit> -> AppDir/lib via the path-mapping hook but treats the helpers as binaries and wraps them elsewhere, so copy them into the webkit dir where the hook expects them
if [ -d /usr/lib/webkit2gtk-4.1 ]; then
    mkdir -p AppDir/lib/webkit2gtk-4.1
    for h in WebKitWebProcess WebKitNetworkProcess WebKitGPUProcess; do
        if [ -f "/usr/lib/webkit2gtk-4.1/$h" ]; then
            cp -v "/usr/lib/webkit2gtk-4.1/$h" "AppDir/lib/webkit2gtk-4.1/$h"
        fi
    done
fi
./quick-sharun --make-appimage
mkdir -p ./dist/appimage
mv -v ./*.AppImage "./dist/appimage/$APP_NAME-linux-${NEU_ARCH}.AppImage"
mv -v ./*.AppImage.zsync "./dist/appimage/$APP_NAME-linux-${NEU_ARCH}.AppImage.zsync" 2>/dev/null || :
echo "All Done!"
