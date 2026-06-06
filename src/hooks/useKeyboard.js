import { useEffect } from 'react';
import { useSchemaStore } from '../store/schemaStore';
import { ALL_TOOLS } from '../engine/constants';

export function useKeyboardShortcuts() {
    const { deleteSelected, duplicateSelected, undo, redo, setTool, selectAll, clearSelection } =
        useSchemaStore();

    useEffect(() => {
        const handler = (e) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            const ctrl = e.ctrlKey || e.metaKey;

            if (ctrl && e.key === 'z') { e.preventDefault(); undo(); return; }
            if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); return; }
            if (ctrl && e.key === 'a') { e.preventDefault(); selectAll(); return; }
            if (ctrl && e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }

            if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return; }
            if (e.key === 'Escape') { clearSelection(); setTool('select'); return; }

            // tool hotkeys
            const tool = ALL_TOOLS.find(t => t.key && t.key.toLowerCase() === e.key.toLowerCase());
            if (tool && !ctrl) setTool(tool.type);
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [deleteSelected, duplicateSelected, undo, redo, setTool, selectAll, clearSelection]);
}