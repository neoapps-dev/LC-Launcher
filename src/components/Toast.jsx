import "./Toast.css";

import { useEffect, useState } from "preact/hooks";

let pushToast;

export function showToast(message, duration = 2500) {
    if (pushToast) pushToast({ message, duration });
};

export default function Toast() {
    const [queue, setQueue] = useState([]);
    const [current, setCurrent] = useState(null);
    const [visible, setVisible] = useState(false);

    pushToast = (toast) => setQueue(q => [...q, toast]);

    useEffect(() => {
        if (current || queue.length < 1) return;

        const next = queue[0];
        setQueue(q => q.slice(1));
        setCurrent(next);
        setVisible(true);

        setTimeout(() => {
            setVisible(false);
            setTimeout(() => setCurrent(null), 400);
        }, next.duration);
    }, [queue, current]);

    return (
        <div id="toast" class={visible ? "show" : ""}>
            {current?.message}
        </div>
    );
};