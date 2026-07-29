import nmd from 'nano-markdown';

import Net from '../lib/net.js';
import { showToast } from '../components/Toast.jsx';

export class Remotes {
    constructor(manager) {
        this.manager = manager;
    };

    getReleasesAPI(instance, tag = null) {
        const { serviceDomain: domain, repo, serviceType } = instance;
        const encodedRepo = encodeURIComponent(repo);
        const encodedTag = tag ? encodeURIComponent(tag) : null;

        switch (serviceType) {
            case "GITHUB":
                if (!tag) return `https://api.${domain}/repos/${repo}/releases?per_page=150`;
                return tag === 'latest' 
                    ? `https://api.${domain}/repos/${repo}/releases/latest`
                    : `https://api.${domain}/repos/${repo}/releases/tags/${encodedTag}`;

            case "GITLAB":
                if (!tag) return `https://${domain}/api/v4/projects/${encodedRepo}/releases`;
                return `https://${domain}/api/v4/projects/${encodedRepo}/releases/${encodedTag}`;

            case "GITEA":
                if (!tag) return `https://${domain}/api/v1/repos/${repo}/releases?limit=150`;
                return tag === 'latest'
                    ? `https://${domain}/api/v1/repos/${repo}/releases/latest`
                    : `https://${domain}/api/v1/repos/${repo}/releases/tags/${encodedTag}`;

            default:
                return null;
        };
    };

    normalizeRelease(service, release) {
        if (!release) return null;

        if (service === "GITLAB") {
            return {
                tag_name: release.tag_name,
                body: release.description,
                assets: (release.assets?.links || []).map(a => ({
                    name: a.name,
                    browser_download_url: a.url,
                    id: a.url
                }))
            };
        };

        return release;
    };

    normalizeReleases(service, data) {
        if (!Array.isArray(data)) return [];
        return data.map(r => this.normalizeRelease(service, r));
    };

    getHeaders(serviceType) {
        const headers = {
            'User-Agent': 'LC-Launcher',
            'Accept': 'application/json'
        };

        if (serviceType === "GITHUB") {
            headers['Accept'] = 'application/vnd.github+json';
            headers['X-GitHub-Api-Version'] = '2026-03-10';
        };

        return headers;
    };

    async list(instance) {
        const apiUrl = this.getReleasesAPI(instance);
        if (!apiUrl) return [];

        try {
            const res = await Net.get(apiUrl, { headers: this.getHeaders(instance.serviceType) });
            const data = res?.data;

            if (res?.ok !== true || !Array.isArray(data)) {
                console.error("API Error or Rate Limit:", data);
                showToast("Error: Release API Error");
                return [];
            };

            const rawReleases = this.normalizeReleases(instance.serviceType, data);
            const releases = rawReleases.filter(r => !r.tag_name?.toLowerCase().includes("server"));

            if (releases.length > 0) return [{ ...releases[0], tag_name: 'latest' }, ...releases];

            return releases;
        } catch (err) {
            console.error("Failed to fetch release list:", err);
            showToast("Error: Release API Error");
            return [];
        };
    };

    async get(instance, tag) {
        if (!tag) return null;

        const apiUrl = this.getReleasesAPI(instance, tag);
        if (!apiUrl) return null;

        try {
            const res = await Net.get(apiUrl, { headers: this.getHeaders(instance.serviceType) });
            
            if (res?.ok !== true || !res?.data) return null;

            return this.normalizeRelease(instance.serviceType, res.data);
        } catch (err) {
            console.error(`Failed to fetch release tag ${tag}:`, err);
            return null;
        };
    };

    async patchnotes(instance, tag) {
        const release = await this.get(instance, tag);
        const plaintxt = release?.body;
        
        if (!plaintxt) return "No patch notes found!";
        
        return nmd(plaintxt);
    };
};