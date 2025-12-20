/**
 * CQL Builder Module
 * Handles the visual CQL pattern builder interface for Advanced Search
 */

let cqlBuilderInstance = null;

export class CqlBuilder {
    constructor() {
        this.container = document.getElementById('cql-builder-container');
        this.cqlTextarea = document.getElementById('cql_query');
        this.manualEditCheckbox = document.getElementById('cql_manual_edit');
        this.warningMsg = document.getElementById('cql-warning');
        this.addTokenBtn = document.getElementById('add-token-btn');
        
        this.tokens = []; // Array of token IDs
        this.tokenCounter = 0;
        this.manualCqlModified = false;

            // register singleton instance
            cqlBuilderInstance = this;

            this.init();
    }

    init() {
        if (!this.container) return;

        // Add initial token
        this.addTokenRow();

        // Event listeners
        if (this.addTokenBtn) {
            this.addTokenBtn.addEventListener('click', () => this.addTokenRow());
        }

        if (this.manualEditCheckbox) {
            this.manualEditCheckbox.addEventListener('change', (e) => {
                this.toggleManualEdit(e.target.checked);
            });
        }

        if (this.cqlTextarea) {
            // ensure readonly by default
            this.cqlTextarea.readOnly = true;
            this.cqlTextarea.addEventListener('input', () => {
                if (this.manualEditCheckbox && this.manualEditCheckbox.checked) {
                    this.manualCqlModified = true;
                    if (this.warningMsg) this.warningMsg.hidden = false;
                }
            });
        }
    }

    toggleManualEdit(enabled) {
        if (this.cqlTextarea) {
            this.cqlTextarea.readOnly = !enabled;
            if (!enabled) {
                this.manualCqlModified = false;
                this.updateCqlFromBuilder();
                if (this.warningMsg) this.warningMsg.hidden = true;
            } else {
                // show hint until user edits
                 if (this.warningMsg) this.warningMsg.hidden = false;
            }
        }
    }

    // external helper to reset manual edit flags (used by SearchUI)
    resetManualEdit() {
        if (this.manualEditCheckbox) this.manualEditCheckbox.checked = false;
        if (this.cqlTextarea) this.cqlTextarea.readOnly = true;
        this.manualCqlModified = false;
        if (this.warningMsg) this.warningMsg.hidden = true;
        this.updateCqlFromBuilder();
    }
    addTokenRow() {
        this.tokenCounter++;
        const tokenId = this.tokenCounter;
        
        const tokenRow = document.createElement('div');
        // MD3: Use only MD3 class, not Bootstrap .card which adds unwanted background
        tokenRow.className = 'cql-token-row';
        tokenRow.dataset.id = tokenId;
        tokenRow.innerHTML = `
            <button type="button" class="md3-button md3-button--icon md3-button--text delete-token-btn" aria-label="Eliminar palabra">
                <span class="material-symbols-rounded">delete</span>
            </button>
            <div class="d-flex align-items-center mb-2">
                <h4 class="md3-title-small m-0">Palabra ${this.tokens.length + 1}</h4>
            </div>
            <div class="row g-2">
                <div class="col-md-4">
                    <div class="md3-outlined-textfield md3-outlined-textfield--select">
                        <select id="campo_${tokenId}" class="md3-outlined-textfield__input cql-input">
                            <option value="word">Forma (word)</option>
                            <option value="lemma">Lema (lemma)</option>
                            <option value="pos">Categoría (POS)</option>
                            <option value="tense">Tiempo (tense)</option>
                            <option value="mood">Modo (mood)</option>
                            <option value="person">Persona (person)</option>
                            <option value="number">Número (number)</option>
                            <option value="PastType">PastType</option>
                            <option value="FutureType">FutureType</option>
                        </select>
                        <label for="campo_${tokenId}" class="md3-outlined-textfield__label">Campo</label>
                         <div class="md3-outlined-textfield__outline">
                            <div class="md3-outlined-textfield__outline-start"></div>
                            <div class="md3-outlined-textfield__outline-notch"></div>
                            <div class="md3-outlined-textfield__outline-end"></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="md3-outlined-textfield md3-outlined-textfield--select">
                        <select id="tipo_${tokenId}" class="md3-outlined-textfield__input cql-input">
                            <option value="is">es exactamente</option>
                            <option value="starts">empieza por</option>
                            <option value="contains">contiene</option>
                            <option value="regex">regex</option>
                        </select>
                        <label for="tipo_${tokenId}" class="md3-outlined-textfield__label">Tipo</label>
                        <div class="md3-outlined-textfield__outline">
                            <div class="md3-outlined-textfield__outline-start"></div>
                            <div class="md3-outlined-textfield__outline-notch"></div>
                            <div class="md3-outlined-textfield__outline-end"></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="md3-outlined-textfield">
                        <input type="text" id="valor_${tokenId}" class="md3-outlined-textfield__input cql-input" placeholder=" ">
                        <label for="valor_${tokenId}" class="md3-outlined-textfield__label">Valor</label>
                        <div class="md3-outlined-textfield__outline">
                            <div class="md3-outlined-textfield__outline-start"></div>
                            <div class="md3-outlined-textfield__outline-notch"></div>
                            <div class="md3-outlined-textfield__outline-end"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add distance row if not the first token
        if (this.tokens.length > 0) {
            const prevTokenId = this.tokens[this.tokens.length - 1];
            const distanceRow = this.createDistanceRow(prevTokenId, tokenId);
            this.container.appendChild(distanceRow);
        }

        this.container.appendChild(tokenRow);
        this.tokens.push(tokenId);

        // Bind events for new inputs
        const inputs = tokenRow.querySelectorAll('.cql-input');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updateCqlFromBuilder());
            input.addEventListener('change', () => this.updateCqlFromBuilder());
        });

        // Bind delete button
        const deleteBtn = tokenRow.querySelector('.delete-token-btn');
        deleteBtn.addEventListener('click', () => this.removeTokenRow(tokenId));

        this.updateLabels();
        this.updateCqlFromBuilder();
    }

    createDistanceRow(prevId, nextId) {
        const row = document.createElement('div');
        row.className = `cql-distance-row d-flex align-items-center justify-content-center my-2 gap-2`;
        row.dataset.prev = prevId;
        row.dataset.next = nextId;
        
        row.innerHTML = `
            <span class="md3-body-small text-muted">Distancia:</span>
            <div class="md3-outlined-textfield md3-outlined-textfield--compact" style="width: 80px;">
                <input type="number" id="dist_min_${prevId}_${nextId}" class="md3-outlined-textfield__input cql-input" value="0" min="0">
                <label class="md3-outlined-textfield__label">Min</label>
                 <div class="md3-outlined-textfield__outline">
                    <div class="md3-outlined-textfield__outline-start"></div>
                    <div class="md3-outlined-textfield__outline-notch"></div>
                    <div class="md3-outlined-textfield__outline-end"></div>
                </div>
            </div>
            <span class="md3-body-small text-muted">-</span>
            <div class="md3-outlined-textfield md3-outlined-textfield--compact" style="width: 80px;">
                <input type="number" id="dist_max_${prevId}_${nextId}" class="md3-outlined-textfield__input cql-input" value="0" min="0">
                <label class="md3-outlined-textfield__label">Max</label>
                 <div class="md3-outlined-textfield__outline">
                    <div class="md3-outlined-textfield__outline-start"></div>
                    <div class="md3-outlined-textfield__outline-notch"></div>
                    <div class="md3-outlined-textfield__outline-end"></div>
                </div>
            </div>
        `;

        const inputs = row.querySelectorAll('.cql-input');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updateCqlFromBuilder());
        });

        return row;
    }

    removeTokenRow(id) {
        if (this.tokens.length <= 1) return;

        const index = this.tokens.indexOf(id);
        if (index === -1) return;

        this.tokens.splice(index, 1);
        
        // Rebuild UI to ensure correct distances
        const tokenRows = [];
        this.tokens.forEach(tid => {
            const tr = this.container.querySelector(`.cql-token-row[data-id="${tid}"]`);
            if (tr) tokenRows.push(tr);
        });
        
        this.container.innerHTML = '';
        
        tokenRows.forEach((tr, idx) => {
            if (idx > 0) {
                const prevId = tokenRows[idx-1].dataset.id;
                const currId = tr.dataset.id;
                const distRow = this.createDistanceRow(prevId, currId);
                this.container.appendChild(distRow);
            }
            this.container.appendChild(tr);
        });

        this.updateLabels();
        this.updateCqlFromBuilder();
    }

    updateLabels() {
        this.tokens.forEach((id, index) => {
            const row = this.container.querySelector(`.cql-token-row[data-id="${id}"]`);
            if (row) {
                row.querySelector('h4').textContent = `Palabra ${index + 1}`;
            }
        });
    }

    updateCqlFromBuilder() {
        if (this.manualCqlModified && this.manualEditCheckbox.checked) return;

        const parts = [];
        
        this.tokens.forEach((id, index) => {
            // Add distance if not first
            if (index > 0) {
                const prevId = this.tokens[index - 1];
                const minInput = document.getElementById(`dist_min_${prevId}_${id}`);
                const maxInput = document.getElementById(`dist_max_${prevId}_${id}`);
                
                let min = minInput ? parseInt(minInput.value) || 0 : 0;
                let max = maxInput ? parseInt(maxInput.value) || 0 : 0;
                
                if (max < min) max = min;
                
                if (min === 0 && max === 0) {
                    // No distance token needed for adjacent
                } else {
                    parts.push(`[]{${min},${max}}`);
                }
            }

            // Build token CQL
            const campo = document.getElementById(`campo_${id}`).value;
            const tipo = document.getElementById(`tipo_${id}`).value;
            const valor = document.getElementById(`valor_${id}`).value.trim();

            if (campo && valor) {
                let val = valor;
                
                if (tipo === 'is') {
                    parts.push(`[${campo}="${val}"]`);
                } else if (tipo === 'starts') {
                    parts.push(`[${campo}="${val}.*"]`); 
                } else if (tipo === 'contains') {
                    parts.push(`[${campo}=".*${val}.*"]`);
                } else if (tipo === 'regex') {
                    parts.push(`[${campo}="${val}"]`);
                }
            }
        });

        const cql = parts.join(' ');
        if (this.cqlTextarea) {
            this.cqlTextarea.value = cql;
        }
    }

    // Backwards-compatibility alias used by the older patternBuilder code
    updateCQLPreview() {
        return this.updateCqlFromBuilder();
    }
}

export function getCqlBuilder() {
    return cqlBuilderInstance;
}
