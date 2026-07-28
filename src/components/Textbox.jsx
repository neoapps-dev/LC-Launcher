import "./Textbox.css";

import { useRef, useEffect } from "preact/hooks";
import { showToast } from "./Toast";

import Button from "./Button.jsx";

import fileIcon from "../assets/buttons/file.svg";
import folderIcon from "../assets/buttons/folder.svg";

export default function Textbox({ id, onchange = (txt) => { }, value = "", placeholder = "", label = "Textbox", minlength = 0, maxlength = 30, isFilePicker = false, isFolderPicker = false, onPick = () => {} }) {
    return (
        <div class="mc-textbox">
            <label for={id}>{label}</label>
            <div class="mc-textbox-inner">
                <input
                    type="text"
                    id={id}
                    className={(isFilePicker || isFolderPicker) ? "picker" : ""}
                    value={value}
                    placeholder={placeholder}
                    maxLength={maxlength}
                    spellCheck="false" 
                    autoCorrect="off"
                    autoCapitalize="off"
                    autoComplete="off"
                    aria-autocomplete="none"
                    onBlur={(e) => {
                        const val = e.target.value.trim();

                        if (val.length === 0 && minlength === 0) return onchange("");

                        if (val.length < minlength)
                            return showToast(`Textbox requires minimum ${minlength} characters`);

                        if (maxlength && val.length > maxlength)
                            return showToast(`Textbox exceeds maximum ${maxlength} characters`);
                        
                        onchange(e.target.value);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                    }}
                />
                {(isFilePicker || isFolderPicker) && 
                    <Button id="mc-textbox-picker" onclick={onPick}>
                        <img src={isFilePicker ? fileIcon : folderIcon} draggable={false} />
                    </Button>
                }
            </div>
        </div>
    );
};