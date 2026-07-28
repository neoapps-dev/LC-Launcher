import Neutralino from "@neutralinojs/lib";
import { showToast } from "../components/Toast.jsx";

import Filesystem from "../lib/filesystem.js";
import { pckFormat, PCKAssetType } from "../utils/pckFormat.js";

export class Profiles {
    constructor(manager) {
        this.manager = manager;
    };

    async list() {
        try {
            // reading in chunks to fix linux webkitgtk issue where it cant read more than about 2mb due to the websocket message size limit
            const profilesContent = await Filesystem.readStream(this.manager.profilesFile);

            console.log(`Profiles fetched with content ${profilesContent?.length || "0"}`);

            if (!profilesContent) throw new Error("File not readable");
            return JSON.parse(profilesContent);
        } catch(e) {
            console.error(`Error fetching profiles`, e);
            return [];
        };
    };

    async get(id) {
        const profiles = await this.list();
        return profiles.find(p => p.id === id);
    };

    async create({ username, skin, uid = this.manager.utils.generateUID(), type = "OFFLINE" }) {
        const profiles = await this.list();

        let skinDataURI, skin64x64DataURI, isSlim, skinRenderDataURI;

        if (skin)
            [skinDataURI, skin64x64DataURI, isSlim, skinRenderDataURI] = await this.manager.skins.process(skin);
        
        const profile = {
            id: crypto.randomUUID(),
            username,
            uid,
            type,
            skin: skinDataURI,
            skin64x64: skin64x64DataURI || null,
            skinRender: skinRenderDataURI,
            isSlim: isSlim || false,
            cape: null
        };

        profiles.push(profile);
        await this.manager.utils.writeJSON(this.manager.profilesFile, profiles);

        return profile;
    };

    async edit(id, prop, value) {
        const profiles = await this.list();

        const profile = profiles.find(p => p.id === id);
        if (!profile) return "Profile not found";
        profile[prop] = value;

        await this.manager.utils.writeJSON(this.manager.profilesFile, profiles);
    };

    async update(id, updates = {}) {
        const profiles = await this.list();
        const index = profiles.findIndex(p => p.id === id);
        
        if (index === -1) throw new Error("Profile not found");

        const profile = profiles[index];
        if (updates.username) profile.username = updates.username;
        if (updates.skin) {
            const [skinDataURI, skin64x64DataURI, isSlim, skinRenderDataURI] = await this.manager.skins.process(updates.skin);
            profile.skin = skinDataURI;
            profile.skin64x64 = skin64x64DataURI || null;
            profile.skinRender = skinRenderDataURI;
            profile.isSlim = isSlim || false;
        };
        if (updates.uid) profile.uid = updates.uid;

        profiles[index] = profile;
        await this.manager.utils.writeJSON(this.manager.profilesFile, profiles);

        return profile;
    };

    async delete(id) {
        let profiles = await this.list();
        profiles = profiles.filter(p => p.id !== id);

        await this.manager.utils.writeJSON(this.manager.profilesFile, profiles);
    };

    async export(id) {
        const data = await this.get(id);
        if (!data) throw new Error("Profile not found");

        const sterilisedData = {
            ...data,
            id: undefined 
        };

        const savePath = await Neutralino.os.showSaveDialog("Export Profile (Must use .lceprofile.json)", {
            filters: [{ name: 'LCE Profile Files', extensions: ['lceprofile.json'] }],
            defaultPath: NL_OS === "Darwin" ? undefined : `${data.username}.lceprofile.json`
        });

        if (!savePath) return false;
        const saveFinal = savePath.trim();
        if (!saveFinal.endsWith(".lceprofile.json")) return showToast("You must save as a .lceprofile.json file");

        if (saveFinal) {
            await this.manager.utils.writeJSON(saveFinal, sterilisedData);
            return true;
        };
        return true;
    };

    async import(jsonStr) {
        try {
            let data;
            try {
                data = JSON.parse(jsonStr);
            } catch (e) {
                showToast("The file you dropped is not a valid JSON document");
                throw new Error("The file is not a valid JSON document.");
            };

            const required = {
                username: "string",
                uid: "string",
                type: [ "OFFLINE" ],
                skin: "string",
                skinRender: "string"
            };

            for (const [field, type] of Object.entries(required)) {
                if (
                    (!data[field] || typeof data[field] !== type) &&
                    !(Array.isArray(type) && type.includes(data[field]))
                ) {
                    showToast(`Invalid or missing required field: ${field}`);
                    throw new Error(`Invalid or missing required field: ${field}`);
                };
            };

            const uidRegex = /^0x[0-9A-F]{16}$/i;
            if (!uidRegex.test(data.uid)) {
                showToast("Invalid UID format in profile");
                throw new Error("Invalid UID format");
            };

            const dataUriRegex = /^data:image\/(png|jpeg|jpg);base64,/;
            if (!dataUriRegex.test(data.skin) || !dataUriRegex.test(data.skinRender)) {
                showToast("Invalid skin data in profile");
                throw new Error("Invalid skin data");
            };

            const profiles = await this.list();
            if (profiles.some(p => p.username.toLowerCase() === data.username.toLowerCase())) {
                showToast("A profile with this username already exists");
                throw new Error("Duplicate username");
            };

            const newProfile = await this.create({
                username: data.username,
                uid: data.uid,
                type: data.type,
                skin: data.skin
            });

            showToast(`Imported ${newProfile.username}`);
            return newProfile;
        } catch (err) {
            console.error("Import failed:", err);
            throw err;
        };
    };

    async readInstanceFiles(id, instanceId) {
        const profiles = await this.list();
        const index = profiles.findIndex(p => p.id === id);
        if (index === -1) throw new Error("Profile not found");

        const contentDir = await Neutralino.filesystem.getJoinedPath(this.manager.instancesDir, instanceId, "content");

        async function readProfileRead(filename) {
            try {
                const data = await Neutralino.filesystem.readBinaryFile(`${contentDir}/${filename}`);
                return btoa(String.fromCharCode(...new Uint8Array(data)));
            } catch {
                return null;
            };
        };

        if (!profiles[index].instanceFiles) profiles[index].instanceFiles = {};
    
        const files = {};
        for (const filename of this.manager.profileInstanceFiles)
            files[filename] = await readProfileRead(filename);

        profiles[index].instanceFiles[instanceId] = files;

        await Filesystem.writeStream(this.manager.profilesFile, profiles);
        //await this.manager.utils.writeJSON(this.manager.profilesFile, profiles);
        console.log("Profile Instance Files saved to:", this.manager.profilesFile, profiles);
    };

    async writeInstanceFiles(id, instanceId) {
        const data = await this.get(id);
        if (!data) throw new Error("Profile not found");
        
        const instData = await this.manager.instances.get(instanceId);
        if (!instData) throw new Error("Instance not found");

        const contentDir = await Neutralino.filesystem.getJoinedPath(this.manager.instancesDir, instanceId, "content");
        const instanceFiles = data?.instanceFiles?.[instanceId] || {};

        for (const filename of this.manager.profileInstanceFiles) {
            const filepath = `${contentDir}/${filename}`;
            const content = instanceFiles[filename];

            if (!content) {
                await Neutralino.filesystem.remove(filepath).catch(e=>{});
                continue;
            };

            const binary = atob(content);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            await Neutralino.filesystem.writeBinaryFile(`${contentDir}/${filename}`, bytes.buffer);
            console.log("Profile Instance File written to:", `${contentDir}/${filename}`, bytes.buffer);
        };
    };

    async removeInstanceFiles(instanceId) {
        const profiles = await this.list();
        
        for (const profile of profiles)
            if (profile.instanceFiles?.[instanceId]) delete profile.instanceFiles[instanceId];

        await Filesystem.writeStream(this.manager.profilesFile, profiles);
        //await this.manager.utils.writeJSON(this.manager.profilesFile, profiles);
    };

    async packDLC(id, instanceId) {
        const profile = await this.get(id);
        if (!profile) throw new Error("Profile not found");

        const instance = await this.manager.instances.get(instanceId);
        if (!instance) throw new Error("Instance not found");

        // default to steve skin
        if (!profile.skin) profile.skin = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAABGdBTUEAALGPC/xhBQAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAABONJREFUaEPll99rVEcUx6+IUk1ijbQYosYfG+OaRtb4g2JEY42/EYuRipqioqIxMQiLVlDE+INqKlSfAkq0UChIUXzwFyL2sU956X9TmofjfM/u9/ZknLs30cUN8cJh5s6cuTvfz5w5MzslSnmaF9QIXP4bGYmmT5um3qjjGfl3arT/28aSX7j9+p8pab8xofsBoLHuC8kt/FKN72iDnd+ek55NK+XnfWviEnW0wya0uLFMDoIpvql+ZiKATCYj1gBlUgDg6nPlURIKSkbApAVgxSICYHY7fBYAAMEXz3yQBKAz2zQ5tgDFQ/Dy+dUKYuHsqjghEgD2vG+TIgcAAIUzCpgMmQOY8UPlWBJtRX2y82YKDKKWzatSsasys2XFooLlFtXINw2FkyA7v0qPPviiDQDohzEYi2+gn99l0sQ4W8c7Iqmi4vHjFgAm3tIwS4VA4OrGWi1peN/cPEfam79WPwChD8agjVFiAZS6R1QcgE66rrBqBeFOmFvFxjq+18jLgTPy9te8/D3YL29v5139nDz+6ZCsWTpHx8AXYzA23i7um/h22j2i4gB0pepdKC+YVVhV944wRj23pFb+vHxSnt/o0/JJf58M5X+UNwN5GTq9Ww0+8MUYjEUd38I38Z52j5gYAOI8UC2ZuTPk5oE2GTq+VdqyX6l4PJ0bBuTFpVMqHnU8gAIf+GIMxjbVV8f7HwDS7hETB4BbMWyFloZaudHZKoNHvpNbh9Y5cdvk2aVj8upaPj7m/rp1Rn7v2S797s4PH/hiDMbiG1x9Aih1j6g4AIY9wvZYR04e9Hwv949v0T83ONbuHu5wAjfJhc1rR9mdwxvl6r516gNfjMFYfEO3QHE7pN0jKg4Ak6cAlEOnduiK/nJwvZzbkZOzW1ukr6NZxcIu7lkt139Yr4Y6fOD7W/dOHXv/xK5CWYRIkPYOgTrBVRyAP4H9O4fFWjabFWupEx4ejv8K+xejyPVFR4+WtrQfePRI9DswV8ftc2/r0rhMG57aXw4AoWsx2soCgOKL5ecNwEWAXX2F/LFPOSIg6b9BWSLA2wIfDWBlNi+wpsVdWm5r+2OU2T6/v611QKIrV/63ri6J7t2T6OFDTZg4Kpk80aZm/VFHG0TRnj6VCMb3JH/6+P0czzItIijwQwAAlgrq7i4Y6px4EQIAqEhOyPpjDPz9SVsA/Da/zz6UBGp//0MBMBLGEwEKIDRBThITRERYkdYf9ZB4GwUhwHaM3//JASDsKQp1OwECsG1J/gBFcLbuC7TR9KkiwOYB7HtrKh6iaJg8BUAQ62y3vgSGCAkBcONxKaPddJcv/P+whjbr4/enpYAolOQoECHu54j3AFhBgGEBhIRZYNwCoTHFbRMCMHi2K4aAfguhLABsHih1CsQ5gBAIgCFv9z9hEAC3jQ175goDxIpjBBAAyhAAbS9CGlMEMAGO9xgMngJ++FMUAfinQAhWAgCItSvsAwhtkbIAKAXovWPQJjz/BMB7Wtb2sjgjgGUIQKkckQqgvb1dYKWOQfTRr7e3V6zFgngh4er54c+E6AOw/vQxCdGK8yMAMGyOYL/dImMGkCSQ7Un9NkfgMuXfI/CuN0YDAH724sXEqveFIhC0YWwSAIoMRUjFAIRyCIEoBCcu9WrtfCxEf4VHJUCX6ELH4HgAvAMPTt9mhQSK5wAAAABJRU5ErkJggg==`;
        
        const supports64x64 = Boolean(instance.supports64x64Skins);
        const supportsSlim = Boolean(instance.supportsSlimSkins);

        const skinUri = (supports64x64 && profile.skin64x64)
            ? profile.skin64x64
            : (profile.skin || defaultSteve);

        const DataURI_Buff = async (uri) => {
            const res = await fetch(uri);
            return await res.arrayBuffer();
        };

        const convert32To64 = (srcUri) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = async () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = 64;
                    canvas.height = 64;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) return reject(new Error("Failed to get 2D context"));

                    ctx.drawImage(img, 0, 0, 64, 32);

                    const copyFlipped = (sx, sy, sw, sh, dx, dy) => {
                        ctx.save();
                        ctx.translate(dx + sw, dy);
                        ctx.scale(-1, 1);
                        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
                        ctx.restore();
                    };

                    // right leg -> left leg
                    // top/bottom faces
                    copyFlipped(4, 16, 4, 4, 20, 48);
                    copyFlipped(8, 16, 4, 4, 24, 48);
                    // side faces
                    copyFlipped(0, 20, 4, 12, 24, 52);
                    copyFlipped(4, 20, 4, 12, 20, 52);
                    copyFlipped(8, 20, 4, 12, 16, 52);
                    copyFlipped(12, 20, 4, 12, 28, 52);

                    // right arm -> left arm
                    // top/bottom faces
                    copyFlipped(44, 16, 4, 4, 36, 48);
                    copyFlipped(48, 16, 4, 4, 40, 48);
                    // side faces
                    copyFlipped(40, 20, 4, 12, 40, 52);
                    copyFlipped(44, 20, 4, 12, 36, 52);
                    copyFlipped(48, 20, 4, 12, 32, 52);
                    copyFlipped(52, 20, 4, 12, 44, 52);

                    const dataUrl = canvas.toDataURL("image/png");
                    console.log(dataUrl)
                    const res = await fetch(dataUrl);
                    const buffer = await res.arrayBuffer();
                    resolve(buffer);
                };
                img.onerror = (err) => reject(new Error(`Failed to load skin image: ${err}`));
                img.src = srcUri;
            });
        };

        let skinBuffer;
        if (supports64x64) {
            if (profile.skin64x64) skinBuffer = await DataURI_Buff(profile.skin64x64);
            else skinBuffer = await convert32To64(profile.skin);
        } else {
            skinBuffer = await DataURI_Buff(profile.skin);
        };

        const isSlim = Boolean(profile.isSlim);
        const animValue = isSlim
            ? supportsSlim
                ? "0x00080000"
                : "0x00041800"
            : supports64x64
                ? "0x00040000"
                : "0x00000000";

        const boxes = [];
        if (isSlim && !supportsSlim) {
            boxes.push({
                key: "BOX",
                value: "ARM0 -2 -2 -2 3 12 4 40 16 0 0 0"
            });
            boxes.push({
                key: "BOX",
                value: "ARM1 -1 -2 -2 3 12 4 40 16 0 1 0"
            });
        };

        let capeBuf = null;
        if (profile.cape) {
            try {
                capeBuf = await DataURI_Buff(profile.cape);
            } catch (e) {
                console.warn("Failed to process profile cape:", e);
            };
        };

        let hash = 0;
        for (let i = 0; i < profile.id.length; i++) {
            hash = (hash << 5) - hash + profile.id.charCodeAt(i);
            hash |= 0;
        };
        const seededId = Math.abs(hash).toString().padStart(8, "0").slice(-8);

        const serializedPckBuffer = pckFormat.serializePCK({
            version: 3,
            endianness: "little",
            xmlSupport: false,
            properties: [
                "ANIM",
                "DISPLAYNAME",
                "THEMENAME",
                "GAME_FLAGS",
                "FREE",
                "BOX"
            ],
            files: [
                {
                    id: `dlcskin${seededId}`,
                    path: `dlcskin${seededId}.png`,
                    type: PCKAssetType.SKIN,
                    size: skinBuffer.byteLength,
                    data: new Uint8Array(skinBuffer),
                    properties: [
                        { key: "DISPLAYNAME", value: profile.username },
                        { key: "GAME_FLAGS", value: "0x18" },
                        { key: "FREE", value: "1" },
                        { key: "ANIM", value: animValue },
                        ...boxes,
                        ...(capeBuf
                            ? [{ key: "CAPEPATH", value: `dlccape${seededId}.png` }]
                            : []
                        )
                    ]
                },
                ...(capeBuf ? [
                    {
                        id: `dlccape${seededId}`,
                        path: `dlccape${seededId}.png`,
                        type: PCKAssetType.CAPE,
                        size: capeBuf.byteLength,
                        data: new Uint8Array(capeBuf),
                        properties: []
                    }
                ] : [])
            ]
        });

        const contentDir = await Neutralino.filesystem.getJoinedPath(this.manager.instancesDir, instanceId, "content");
        const outputDir = `${contentDir}/Windows64Media/DLC/LC Launcher Profile`;
        const outputPath = `${outputDir}/Skins1.pck`;

        await this.manager.utils.ensureDir(outputDir);
        await Neutralino.filesystem.writeBinaryFile(outputPath, serializedPckBuffer);
        console.log(`Packed profile DLC to: ${outputPath}`);

        return outputPath;
    };
};