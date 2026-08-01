(async () => {
    if (NL_OS === "Windows") document.body.style.background = "#000"; // fix white screen when open on windows

    const { default: Neutralino } = await import("@neutralinojs/lib");
    Neutralino.init(); // this stalls entire app
    if (NL_ARGS.includes("--neu-dev-extension")) window._neutralino = Neutralino; // huge ram increase prob

    const { startLogger } = await import("./utils/logger.js");
    startLogger();
    console.log(`

Loading LC Launcher...
---------------------------
App Name: ${NL_APPID}
Version: ${NL_APPVERSION}
Operating System: ${NL_OS}
Architecture: ${NL_ARCH}
Locale: ${NL_LOCALE}
Args: ${NL_ARGS}
NJS Client: ${NL_CVERSION || "Unknown"} (${NL_CCOMMIT || "Unknown"})
NJS Server: ${NL_VERSION || "Unknown"} (${NL_COMMIT || "Unknown"})
---------------------------
`);

    if (NL_OS === "Darwin") {
        const { default: darwinIcon } = await import("./assets/darwin_icon.png");
        if(NL_ARGS.includes("--neu-dev-extension")) await Neutralino.window.setIcon(`/src${darwinIcon}`); // dev mode acts differently as the resources path is different due to vite bundling
        else await Neutralino.window.setIcon(`/public${darwinIcon}`);
    };

    if (NL_PATH.includes("/AppTranslocation/")) {
        await Neutralino.os.showMessageBox(
            "LC Launcher",
            "Move LC Launcher out of the Downloads folder. MacOS app translocation prevents it from running while in the Downloads folder."
        );
        return await Neutralino.app.exit();
    };

    await import("./main.jsx");
})();