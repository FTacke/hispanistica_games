import { getPatternBuilder } from "./patternBuilder.js";
import { getCqlBuilder } from "./cqlBuilder.js";

export function initSearchMode() {
    const tabAdvanced = document.querySelector('button[data-tab="advanced"]');
    const qInput = document.getElementById('q');
    const cqlInput = document.getElementById('cql_query') || document.getElementById('cql-preview');
    const manualEditCheckbox = document.getElementById('cql_manual_edit') || document.getElementById('allow-manual-edit');
    const cqlWarning = document.getElementById('cql-warning');
    
    const formSimple = document.getElementById('form-simple');
    const formAdvanced = document.getElementById('form-advanced');

    // Initialize Builder from Q when switching to Advanced tab
    if (tabAdvanced) {
        tabAdvanced.addEventListener('click', () => {
            // Small delay to ensure visibility if needed
            setTimeout(initBuilderFromQ, 0);
        });
    }

    function initBuilderFromQ() {
        const builder = getPatternBuilder() || getCqlBuilder();
        if (!builder) return;

        // Check if builder is "empty" (first token has no value)
        const builderContainer = document.getElementById('pattern-builder');
        if (!builderContainer) return;
        
        const firstTokenValueInput = builderContainer.querySelector('.token-value-input');
        const firstTokenValue = firstTokenValueInput ? firstTokenValueInput.value : '';
        
        // If builder is empty and q has value
        if (!firstTokenValue && qInput && qInput.value.trim() !== '') {
            // Sync query to first token
                if (builder.syncQueryToFirstToken) {
                builder.syncQueryToFirstToken(qInput.value);
            }
            
            // Set field to 'lemma' by default if available
            const firstTokenSelect = builderContainer.querySelector('.token-field-select');
            if (firstTokenSelect) {
                firstTokenSelect.value = 'lema'; 
                firstTokenSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    // Manual Edit Logic
    if (manualEditCheckbox && cqlInput) {
        manualEditCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                cqlInput.removeAttribute('readonly');
                if (cqlWarning) cqlWarning.hidden = false;
            } else {
                cqlInput.setAttribute('readonly', 'true');
                if (cqlWarning) cqlWarning.hidden = true;
                
                const builder = getPatternBuilder() || getCqlBuilder();
                if (builder) {
                    if (typeof builder.updateCQLPreview === 'function') builder.updateCQLPreview();
                    if (typeof builder.updateCqlFromBuilder === 'function') builder.updateCqlFromBuilder();
                }
            }
        });
    }

    // Form Simple Submission Validation
    if (formSimple) {
        formSimple.addEventListener('submit', (e) => {
            if (!qInput.value.trim()) {
                e.preventDefault();
                alert('Por favor, introduzca un término de búsqueda.');
                qInput.focus();
            }
        });
    }

    // Form Advanced Submission Validation
    if (formAdvanced) {
        formAdvanced.addEventListener('submit', (e) => {
            if (!cqlInput.value.trim()) {
                e.preventDefault();
                alert('Defina al menos un patrón o una consulta CQL.');
            }
        });
    }
}
