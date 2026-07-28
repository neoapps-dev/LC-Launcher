import "./CreateInstance.css";

import Neutralino from "@neutralinojs/lib";
import { useState, useEffect } from "preact/hooks";
import { useManager } from "../utils/ManagerProvider.jsx";

import { showToast } from "../components/Toast.jsx";
import Button from "../components/Button.jsx";
import Textbox from "../components/Textbox.jsx";
import Select from "../components/Select.jsx";

import closeIcon from "../assets/buttons/close.svg";

export default function CreateInstanceMenu({ setMenu, setInstance, reloadData }) {
    const Manager = useManager();

    const [ready, setReady] = useState(false);
    const [processing, setProcessing] = useState(false);

    const [availableTags, setAvailableTags] = useState([]);
    const [availableAssets, setAvailableAssets] = useState([]);
    const [backgroundMode, setBackgroundMode] = useState("SINGLE");
    
    const [form, setForm] = useState({
        name: "",
        icon: "",
        logo: "",
        background: "",
        repo: "",
        tag: "",
        exec: "Minecraft.Client.exe",
        target: "",
        serviceType: "GITHUB",
        serviceDomain: "github.com",
        compatibilityLayer: "DIRECT",
        supportsSlimSkins: false,
        supports64x64Skins: false,
        ip: "",
        port: "",
        fullscreen: false,
        quitOnDisconnect: false,
        customArgs: ""
    });

    useEffect(() => {
        if (form.serviceType === "LOCAL" || form.serviceType === "URL") setReady(!!(form.name && form.exec && form.repo));
    }, [form.name, form.exec, form.repo, form.tag, form.target, form.serviceType]);

    useEffect(() => {
        if (form.serviceType === "URL" || form.serviceType === "LOCAL") {
            setAvailableTags([]);
            setAvailableAssets([]);
            return;
        };

        const parts = form.repo.split('/');
        if (parts.length < 2 || !parts[0] || !parts[1]) return setAvailableTags([]);

        const fetchRepoData = async () => {
            try {
                const releases = await Manager.remotes.list({
                    serviceType: form.serviceType,
                    serviceDomain: form.serviceDomain,
                    repo: form.repo
                });
                
                const tags = releases.map(r => ({ label: r.tag_name, value: r.tag_name, assets: r.assets }))
                setAvailableTags(tags);
                
                if (tags.length > 0 && !form.tag) {
                    const nightlyTag = tags.find(t => t.value.toLowerCase() == "nightly");
                    if (nightlyTag) updateForm('tag', nightlyTag.value);
                    else updateForm('tag', tags[0].value);
                };
            } catch (e) {
                console.error("Failed to fetch repo data", e);
                setAvailableTags([]);
                setAvailableAssets([]);
                updateForm('tag', '');
                updateForm('target', '');
            };
        };

        const timeoutId = setTimeout(fetchRepoData, 100);
        return () => clearTimeout(timeoutId);
    }, [form.repo, form.serviceType, form.serviceDomain]);

    useEffect(() => {
        if (form.serviceType === "URL" || form.serviceType === "LOCAL") return;

        const selectedRelease = availableTags.find(t => t.value === form.tag);
        if (selectedRelease?.assets) {
            const assets = selectedRelease.assets.map(a => ({ label: a.name, value: a.name }));
            const filteredAssets = assets.filter(e => {
                const name = e.value.toLowerCase();
                return name.endsWith(".zip") || name.endsWith(".tar.gz") || name.endsWith(".tar.xz");
            });
            setAvailableAssets(filteredAssets);

            if (filteredAssets.length > 0) updateForm('target', filteredAssets[0].value);
        } else {
            setAvailableAssets([]);
        };
    }, [form.tag, availableTags]);

    const updatePanorama = (index, value) => {
        setForm(prev => {
            const currentBackground = Array.isArray(prev.background) 
                ? [...prev.background] 
                : ["", "", "", "", "", ""];
            
            currentBackground[index] = value;
            return { ...prev, background: currentBackground };
        });
    };

    const updateForm = (key, val) => {
        setForm(prev => {
            const mod = { ...prev, [key]: val };
        
            if (mod.serviceType === "LOCAL" || mod.serviceType === "URL") {
                setReady(!!(mod.name && mod.exec && mod.repo)); 
            } else {
                setReady(!!(mod.name && mod.exec && mod.repo && mod.tag && mod.target));
            };

            return mod;
        });
    };

    const handleCreate = async () => {
        setProcessing(true);
        try {
            const tempForm = { ...form };

            if (tempForm.serviceType === "URL") {
                try {
                    const url = new URL(tempForm.repo);
                    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Protocol must be HTTP or HTTPS");
                    if (!(url.pathname.endsWith(".zip") || url.pathname.endsWith(".tar.gz") || url.pathname.endsWith(".tar.xz"))) throw new Error("File extension must be .zip / .tar.gz / .tar.xz");
                } catch (e) {
                    showToast("Invalid URL given");
                    setProcessing(false);
                    return;
                };
            } else if (tempForm.serviceType === "LOCAL") {
                try {
                    const stats = await Neutralino.filesystem.readDirectory(tempForm.repo);
                    const hasExec = stats.some(e => e.entry.toLowerCase() === tempForm.exec.toLowerCase());

                    if (!hasExec) showToast(`Warning: '${tempForm.exec}' not found in target folder`);
                } catch (e) {
                    showToast("Local Build Path does not exist");
                    setProcessing(false);
                    return;
                };
            };

            if (tempForm.serviceType === "CODEBERG") tempForm.serviceType = "GITEA";
            if (tempForm.icon?.trim() === "") tempForm.icon = null;
            if (tempForm.logo?.trim() === "") tempForm.logo = null;

            if (Array.isArray(tempForm.background)) {
                tempForm.background = tempForm.background.map(uri => uri?.trim() || null);
                if (tempForm.background.every(item => item === null)) tempForm.background = null;
            } else tempForm.background = tempForm.background?.trim() || null;

            const newInst = await Manager.instances.create(crypto.randomUUID(), tempForm);
            await reloadData();
            setInstance(newInst);
            setMenu('main');
        } catch (err) {
            showToast("Error: " + err.message);
        } finally {
            setProcessing(false);
        };
    };

    async function testFolderPath(path) {
        try {
            const stats = await Neutralino.filesystem.getStats(path);
            if (stats.type == "FILE") throw new Error();
            return true;
        } catch {
            return false;
        };
    };

    async function testPath(path) {
        try {
            await Neutralino.filesystem.getStats(path);
            return true;
        } catch {
            return false;
        };
    };

    return (
        <>
            <div id="top-bar">
                <h1>Create Instance</h1>
                <div id="main-actions">
                    <Button id="back-button" onclick={() => setMenu('main')}>
                        <img src={closeIcon} draggable={false} />
                    </Button>
                </div>
            </div>

            <div id="create-instance">
                <div className="instance-section">
                    <h3>General</h3>
                    <Textbox
                        label="Instance Name"
                        value={form.name}
                        onchange={(v) => updateForm('name', v)}
                        placeholder="My Instance"
                    />
                    <Textbox
                        label="Executable"
                        value={form.exec}
                        onchange={(v) => updateForm('exec', v)}
                        placeholder="Minecraft.Client.exe"
                        maxlength={100}
                    />
                    <Select
                        label="Compatibility Layer"
                        value={form.compatibilityLayer}
                        options={[
                            { label: "None (Direct)", value: "DIRECT" },
                            { label: "Runtime", value: "RUNTIME" },
                            { label: "Wine64", value: "WINE64" },
                            { label: "Wine", value: "WINE" },
                            { label: "Proton", value: "PROTON" }
                        ]}
                        onChange={(val) => updateForm('compatibilityLayer', val)}
                    />
                    <Textbox
                        label="Custom Args"
                        value={form.customArgs}
                        onchange={(v) => updateForm('customArgs', v)}
                        placeholder='-flag "example"'
                        maxlength={100}
                    />
                </div>

                <div className="instance-section">
                    <h3>Repository</h3>
                    <Select 
                        label="Service Type"
                        value={form.serviceType}
                        options={[
                            { label: "GitHub", value: "GITHUB" },
                            { label: "GitLab", value: "GITLAB" },
                            { label: "Gitea / Forgejo", value: "GITEA" },
                            { label: "Codeberg", value: "CODEBERG" },
                            { label: "Direct Download Link", value: "URL" },
                            { label: "Local Build Directory", value: "LOCAL" }
                        ]}
                        onChange={(val) => {
                            let domain = "";
                            if (val === "GITHUB") domain = "github.com";
                            if (val === "GITLAB") domain = "gitlab.com";
                            if (val === "CODEBERG") domain = "codeberg.org";

                            setForm(prev => ({ ...prev, serviceType: val, serviceDomain: domain, tag: "", target: "", repo: ""}));
                        }}
                    />
                    {(form.serviceType === "GITEA") && (
                        <Textbox 
                            label="Service Domain" 
                            value={form.serviceDomain} 
                            onchange={(v) => updateForm('serviceDomain', v)} 
                            placeholder="gitea.com" 
                        />
                    )}
                    <Textbox
                        label={
                            form.serviceType === "LOCAL" ? "Local Build Path" :
                            form.serviceType === "URL" ? "Direct Download Link (.zip / .tar.gz / .tar.xz)" :
                            "Repository (User/Repo)"
                        }
                        value={form.repo}
                        onchange={(v) => updateForm('repo', v)}
                        placeholder={
                            form.serviceType === "LOCAL" ? "/home/ghost/Documents/LCEBuild" :
                            form.serviceType === "URL" ? "https://example.com/LCEWindows64.zip" :
                            "ghost/LCESource"
                        }
                        maxlength={200}
                        isFolderPicker={form.serviceType === "LOCAL"}
                        onPick={async () => {
                            const res = await Neutralino.os.showFolderDialog("Select a build folder");
                            if (!res || res.length === 0) return;
                            const src = res[0].trim();

                            if (!(await testFolderPath(src))) return showToast("Couldn't find local build folder");

                            updateForm('repo', res);
                        }}
                    />
                    {form.serviceType !== "URL" && form.serviceType !== "LOCAL" && (
                        <>
                            <Select 
                                label="Release Tag"
                                value={form.tag}
                                options={availableTags}
                                onChange={(val) => updateForm('tag', val)}
                                disabled={availableTags.length === 0}
                            />

                            <Select 
                                label="Release Asset (.zip / .tar)"
                                value={form.target}
                                options={availableAssets}
                                onChange={(val) => updateForm('target', val)}
                                disabled={availableAssets.length === 0}
                            />
                        </>
                    )}
                </div>
                
                <div className="instance-section">
                    <h3>Assets</h3>
                    <Textbox
                        label="Icon Data URI"
                        value={form.icon}
                        onchange={(v) => updateForm('icon', v)}
                        maxlength={99999}
                        placeholder="data:image/png;base64..."
                        isFilePicker={true}
                        onPick={async () => {
                            const res = await Neutralino.os.showOpenDialog(
                                "Select an instance icon",
                                {
                                    multiSelections: false,
                                    filters: [
                                        {name: 'Images', extensions: ['jpg', 'jpeg', 'png']},
                                    ]
                                }
                            );
                            if (!res || res.length === 0) return;
                            const src = res[0].trim();
                            if (!src.endsWith(".jpg") &&
                                !src.endsWith(".jpeg") &&
                                !src.endsWith(".png"))
                                return showToast("Please select a valid image file"); // extra check as sometimes a file explorer bypasses filter

                            if (!(await testPath(src))) 
                                return showToast("Couldn't find image from path");
                            
                            try {
                                const maxImgSize = 128 * 1024; // 128KiB
                                const stats = await Neutralino.filesystem.getStats(src);
                                if (stats.size > maxImgSize) return showToast("Image is too large, max is 128KiB");
                                
                                const buffer = await Neutralino.filesystem.readBinaryFile(src);

                                const bytes = new Uint8Array(buffer);
                                let binary = '';
                                for (let i = 0; i < bytes.byteLength; i++) {
                                    binary += String.fromCharCode(bytes[i]);
                                };
                                const base64 = btoa(binary);

                                const mimeType = src.endsWith(".png") ? 'image/png' : 'image/jpeg';
                                const dataUri = `data:${mimeType};base64,${base64}`;

                                updateForm('icon', dataUri);
                            } catch (err) {
                                console.error(err);
                                showToast("Failed to process the image file");
                            };
                        }}
                    />
                    <Textbox
                        label="Logo Data URI"
                        value={form.logo}
                        onchange={(v) => updateForm('logo', v)}
                        maxlength={99999}
                        placeholder="data:image/png;base64..."
                        isFilePicker={true}
                        onPick={async () => {
                            const res = await Neutralino.os.showOpenDialog(
                                "Select an instance logo",
                                {
                                    multiSelections: false,
                                    filters: [
                                        {name: 'Images', extensions: ['jpg', 'jpeg', 'png']},
                                    ]
                                }
                            );
                            if (!res || res.length === 0) return;
                            const src = res[0].trim();
                            if (!src.endsWith(".jpg") &&
                                !src.endsWith(".jpeg") &&
                                !src.endsWith(".png"))
                                return showToast("Please select a valid image file"); // extra check as sometimes a file explorer bypasses filter

                            if (!(await testPath(src))) 
                                return showToast("Couldn't find image from path");
                            
                            try {
                                const maxImgSize = 512 * 1024; // 512KiB
                                const stats = await Neutralino.filesystem.getStats(src);
                                if (stats.size > maxImgSize) return showToast("Image is too large, max is 512KiB");
                                
                                const buffer = await Neutralino.filesystem.readBinaryFile(src);

                                const bytes = new Uint8Array(buffer);
                                let binary = '';
                                for (let i = 0; i < bytes.byteLength; i++) {
                                    binary += String.fromCharCode(bytes[i]);
                                };
                                const base64 = btoa(binary);

                                const mimeType = src.endsWith(".png") ? 'image/png' : 'image/jpeg';
                                const dataUri = `data:${mimeType};base64,${base64}`;

                                updateForm('logo', dataUri);
                            } catch (err) {
                                console.error(err);
                                showToast("Failed to process the image file");
                            };
                        }}
                    />
                    <Select
                        label="Background Mode"
                        value={backgroundMode}
                        options={[
                            { label: "Single Image", value: "SINGLE" },
                            { label: "Panorama (6 Images)", value: "PANORAMA" }
                        ]}
                        onChange={(val) => {
                            setBackgroundMode(val);
                            updateForm('background', val === "PANORAMA" ? ["", "", "", "", "", ""] : "");
                        }}
                    />
                    {backgroundMode === "SINGLE" ? (
                        <Textbox
                            label="Background Data URI"
                            value={form.background}
                            onchange={(v) => updateForm('background', v)}
                            maxlength={99999}
                            placeholder="data:image/png;base64..."
                            isFilePicker={true}
                            onPick={async () => {
                                const res = await Neutralino.os.showOpenDialog(
                                    "Select an instance background",
                                    {
                                        multiSelections: false,
                                        filters: [
                                            {name: 'Images', extensions: ['jpg', 'jpeg', 'png']},
                                        ]
                                    }
                                );
                                if (!res || res.length === 0) return;
                                const src = res[0].trim();
                                if (!src.endsWith(".jpg") &&
                                    !src.endsWith(".jpeg") &&
                                    !src.endsWith(".png"))
                                    return showToast("Please select a valid image file"); // extra check as sometimes a file explorer bypasses filter

                                if (!(await testPath(src))) 
                                    return showToast("Couldn't find image from path");
                                
                                try {
                                    const maxImgSize = 2 * 1024 * 1024; // 2MiB
                                    const stats = await Neutralino.filesystem.getStats(src);
                                    if (stats.size > maxImgSize) return showToast("Image is too large, max is 2MiB");
                                    
                                    const buffer = await Neutralino.filesystem.readBinaryFile(src);

                                    const bytes = new Uint8Array(buffer);
                                    let binary = '';
                                    for (let i = 0; i < bytes.byteLength; i++) {
                                        binary += String.fromCharCode(bytes[i]);
                                    };
                                    const base64 = btoa(binary);

                                    const mimeType = src.endsWith(".png") ? 'image/png' : 'image/jpeg';
                                    const dataUri = `data:${mimeType};base64,${base64}`;

                                    updateForm('background', dataUri);
                                } catch (err) {
                                    console.error(err);
                                    showToast("Failed to process the image file");
                                };
                            }}
                        />
                    ) : (
                        <>
                            {["Front (0)", "Right  (1)", "Back (2)", "Left (3)", "Up (4)", "Down (5)"].map((label, i) => (
                                <Textbox
                                    key={i}
                                    label={`Panorama ${label} Data URI`}
                                    value={Array.isArray(form.background) ? form.background[i] : ""}
                                    onchange={(v) => updatePanorama(i, v)}
                                    maxlength={99999}
                                    placeholder="data:image/png;base64..."
                                    isFilePicker={true}
                                    onPick={async () => {
                                        const res = await Neutralino.os.showOpenDialog(
                                            "Select a panorama cubemap face",
                                            {
                                                multiSelections: false,
                                                filters: [
                                                    {name: 'Images', extensions: ['jpg', 'jpeg', 'png']},
                                                ]
                                            }
                                        );
                                        if (!res || res.length === 0) return;
                                        const src = res[0].trim();
                                        if (!src.endsWith(".jpg") &&
                                            !src.endsWith(".jpeg") &&
                                            !src.endsWith(".png"))
                                            return showToast("Please select a valid image file"); // extra check as sometimes a file explorer bypasses filter

                                        if (!(await testPath(src))) 
                                            return showToast("Couldn't find image from path");
                                        
                                        try {
                                            const maxImgSize = 256 * 1024; // 256KiB
                                            const stats = await Neutralino.filesystem.getStats(src);
                                            if (stats.size > maxImgSize) return showToast("Image is too large, max is 256KiB");
                                            
                                            const buffer = await Neutralino.filesystem.readBinaryFile(src);

                                            const bytes = new Uint8Array(buffer);
                                            let binary = '';
                                            for (let i = 0; i < bytes.byteLength; i++) {
                                                binary += String.fromCharCode(bytes[i]);
                                            };
                                            const base64 = btoa(binary);

                                            const mimeType = src.endsWith(".png") ? 'image/png' : 'image/jpeg';
                                            const dataUri = `data:${mimeType};base64,${base64}`;

                                            updatePanorama(i, dataUri)
                                        } catch (err) {
                                            console.error(err);
                                            showToast("Failed to process the image file");
                                        };
                                    }}
                                />
                            ))}
                        </>
                    )}
                </div>

                <div className="instance-section">
                    <h3>Flags</h3>
                    <Textbox
                        label="IP"
                        value={form.ip}
                        onchange={(v) => updateForm('ip', v)}
                        maxlength={32}
                        placeholder="lce.example.net"
                    />
                    <Textbox
                        label="Port"
                        value={form.port}
                        onchange={(v) => updateForm('port', v)}
                        maxlength={5}
                        placeholder="25565"
                    />
                    <Button onclick={() => updateForm('fullscreen', !form.fullscreen)}>
                        {form.fullscreen == false ? 'Fullscreen: Disabled' : 'Fullscreen: Enabled'}
                    </Button>
                    <Button onclick={() => updateForm('quitOnDisconnect', !form.quitOnDisconnect)}>
                        {form.quitOnDisconnect == false ? 'Quit On Disconnect: Disabled' : 'Quit On Disconnect: Enabled'}
                    </Button>
                    <Button onclick={() => updateForm('supportsSlimSkins', !form.supportsSlimSkins)}>
                        {form.supportsSlimSkins == false ? 'Slim Skins: Disabled' : 'Slim Skins: Enabled'}
                    </Button>
                    <Button onclick={() => updateForm('supports64x64Skins', !form.supports64x64Skins)}>
                        {form.supports64x64Skins == false ? '64x64 Skins: Disabled' : '64x64 Skins: Enabled'}
                    </Button>
                </div>
            </div>

            <div id="create-instance-action-bar">
                <div></div>
                <Button disabled={processing || !ready} pushable={!processing && ready} onclick={handleCreate}>
                    Create
                </Button>
            </div>
        </>
    );
};