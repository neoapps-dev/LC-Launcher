import "./Alert.css";

import { useEffect, useState } from "preact/hooks";
import Button from "./Button.jsx";

let pushAlert;

export function showAlert(title, message, type = "CANCEL_OK", align = "CENTER") {
    if (!pushAlert) return Promise.resolve("NO");
    return new Promise((resolve) => pushAlert({ title, message, type, align, resolve }));
};

export default function Alert() {
    const [queue, setQueue] = useState([]);
    const [current, setCurrent] = useState(null);
    const [visible, setVisible] = useState(false);

    pushAlert = (alertItem) => setQueue((q) => [...q, alertItem]);

    useEffect(() => {
        if (current || queue.length < 1) return;

        const next = queue[0];
        setQueue((q) => q.slice(1));
        setCurrent(next);
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setVisible(true);
            });
        });
    }, [queue, current]);

    useEffect(() => {
        if (!visible) return;

        const handleKeyDown = (e) => {
            if (e.key === "Tab") return e.preventDefault();
            if (e.key === "Escape") return handleAction(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [visible]);

    const handleAction = (confirmed) => {
        setVisible(false);

        setTimeout(() => {
            if (current?.resolve) current.resolve(confirmed ? "YES" : "NO");
            setCurrent(null);
        }, 300);
    };

    if (!current) return null;

    return (
        <div
            class={`alert ${visible ? "open" : ""}`}
            onClick={() => handleAction(false)}
        >
            <div
                class="alert-box"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 class="alert-title">{current.title}</h2>
                <div class="alert-body" style={{ textAlign: current?.align?.toLowerCase() || "center" }}>
                    <p>
                        {current.message.split("\n").map((line, index, array) => (
                            <>
                                {line}
                                {index < array.length - 1 && <br />}
                            </>
                        ))}
                    </p>
                </div>
                <div class="alert-actions">
                    {current.type === "YES_NO" &&
                        <>
                            <Button type="destructive" onclick={() => handleAction(false)}>
                                No
                            </Button>
                            <Button onclick={() => handleAction(true)}>
                                Yes
                            </Button>
                        </>
                    }
                    {current.type === "CANCEL_OK" &&
                        <>
                            <Button type="destructive" onclick={() => handleAction(false)}>
                                Cancel
                            </Button>
                            <Button onclick={() => handleAction(true)}>
                                OK
                            </Button>
                        </>
                    }
                    {current.type === "OK" &&
                        <>
                            <Button onclick={() => handleAction(true)}>
                                OK
                            </Button>
                        </>
                    }
                </div>
            </div>
        </div>
    );
};