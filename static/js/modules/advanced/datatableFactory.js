// Shared DataTables base configuration factory
// Exports: makeBaseConfig() -> returns an object with defaults

import { MEDIA_ENDPOINT } from "../search/config.js";

export function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

export function renderAudioButtons(row) {
  const hasAudio = row.start_ms && row.filename;
  if (!hasAudio) return '<span class="md3-datatable__empty">-</span>';

  const filename = row.filename || "";
  const tokenIdOriginal = row.token_id ? String(row.token_id).trim() : "";
  const tokenId = tokenIdOriginal.toLowerCase();

  const startMs = row.start_ms || row.start || 0;
  const endMs = row.end_ms || parseInt(startMs) + 5000;
  const contextStartMs = row.context_start || startMs;
  const contextEndMs = row.context_end || endMs;

  const startSec = (startMs / 1000).toFixed(3);
  const endSec = (endMs / 1000).toFixed(3);
  const contextStartSec = (contextStartMs / 1000).toFixed(3);
  const contextEndSec = (contextEndMs / 1000).toFixed(3);

  // MD3: Use Material Symbols instead of FontAwesome
  return `
    <div class="md3-corpus-audio-buttons">
      <div class="md3-corpus-audio-row">
        <span class="md3-corpus-audio-label">Res.:</span>
        <a class="audio-button" data-filename="${escapeHtml(filename)}" data-start="${startSec}" data-end="${endSec}" data-token-id="${escapeHtml(tokenIdOriginal)}" data-token-id-lower="${escapeHtml(tokenId)}" data-type="pal">
          <span class="material-symbols-rounded">play_arrow</span>
        </a>
        <a class="download-button" data-filename="${escapeHtml(filename)}" data-start="${startSec}" data-end="${endSec}" data-token-id="${escapeHtml(tokenIdOriginal)}" data-token-id-lower="${escapeHtml(tokenId)}" data-type="pal">
          <span class="material-symbols-rounded">download</span>
        </a>
      </div>
      <div class="md3-corpus-audio-row">
        <span class="md3-corpus-audio-label">Ctx:</span>
        <a class="audio-button" data-filename="${escapeHtml(filename)}" data-start="${contextStartSec}" data-end="${contextEndSec}" data-token-id="${escapeHtml(tokenIdOriginal)}" data-token-id-lower="${escapeHtml(tokenId)}" data-type="ctx">
          <span class="material-symbols-rounded">play_arrow</span>
        </a>
        <a class="download-button" data-filename="${escapeHtml(filename)}" data-start="${contextStartSec}" data-end="${contextEndSec}" data-token-id="${escapeHtml(tokenIdOriginal)}" data-token-id-lower="${escapeHtml(tokenId)}" data-type="ctx">
          <span class="material-symbols-rounded">download</span>
        </a>
      </div>
    </div>
  `;
}

export function renderFileLink(filename, type, row) {
  if (!filename) return "";
  if (type === "sort" || type === "type") return filename;
  // Extract just the base filename without path or extension
  let base = filename.trim();
  // If filename contains path separators, extract just the basename
  if (base.includes('/') || base.includes('\\')) {
    base = base.split(/[\/\\]/).pop();
  }
  // Remove .mp3 or .tsv extensions
  base = base.replace(/\.(mp3|tsv)$/i, "");
  const transcriptionPath = `${MEDIA_ENDPOINT}/transcripts/${encodeURIComponent(base)}.json`;
  const audioPath = `${MEDIA_ENDPOINT}/full/${encodeURIComponent(base)}.mp3`;
  let playerUrl = `/player?transcription=${encodeURIComponent(transcriptionPath)}&audio=${encodeURIComponent(audioPath)}`;
  if (row && row.token_id) {
    playerUrl += `&token_id=${encodeURIComponent(row.token_id)}`;
  }
  // MD3: Use Material Symbols
  return `
    <a href="${playerUrl}" class="player-link" title="${escapeHtml(filename)}">
      <span class="material-symbols-rounded">description</span>
    </a>
  `;
}

export function makeBaseConfig() {
  return {
    serverSide: true,
    processing: true,
    deferRender: true,
    autoWidth: false,
    searching: false,
    ordering: true,
    pageLength: 50,
    lengthMenu: [25, 50, 100],
    dom: '<"top"pB<"ml-auto"lf>>rt<"bottom"ip>',
    buttons: [
      {
        extend: "copyHtml5",
        text: '<span class="material-symbols-rounded">content_copy</span> Copiar',
        exportOptions: { columns: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11] },
      },
      {
        extend: "csvHtml5",
        text: '<span class="material-symbols-rounded">csv</span> CSV',
        exportOptions: { columns: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11] },
      },
      {
        extend: "excelHtml5",
        text: '<span class="material-symbols-rounded">table</span> Excel',
        exportOptions: { columns: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11] },
      },
      {
        extend: "pdfHtml5",
        text: '<span class="material-symbols-rounded">picture_as_pdf</span> PDF',
        orientation: "landscape",
        pageSize: "A4",
        exportOptions: { columns: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11] },
        customize: function (doc) {
          doc.defaultStyle.fontSize = 8;
          doc.styles.tableHeader.fontSize = 9;
        },
      },
    ],
    responsive: false,
    columnDefs: [
      {
        // #
        targets: 0,
        render: function (data, type, row, meta) {
          return meta.row + meta.settings._iDisplayStart + 1;
        },
        width: "40px",
        searchable: false,
        orderable: false,
      },
      {
        // left context
        targets: 1,
        data: "context_left",
        render: function (data) {
          return `<span class="md3-corpus-context">${escapeHtml(data || "")}</span>`;
        },
        className: "md3-datatable__cell--context right-align",
        width: "200px",
      },
      {
        // match
        targets: 2,
        data: "text",
        render: function (data) {
          return `<span class="md3-corpus-keyword"><mark>${escapeHtml(data || "")}</mark></span>`;
        },
        className: "md3-datatable__cell--match center-align",
        width: "150px",
      },
      {
        // right context
        targets: 3,
        data: "context_right",
        render: function (data) {
          return `<span class="md3-corpus-context">${escapeHtml(data || "")}</span>`;
        },
        className: "md3-datatable__cell--context",
        width: "200px",
      },
      {
        // audio
        targets: 4,
        data: null,
        render: function (data, type, row) {
          return renderAudioButtons(row);
        },
        width: "120px",
        orderable: false,
        className: "md3-datatable__cell--audio center-align",
      },
      {
        targets: 5,
        data: "country_code",
        render: function (data, type) {
          if (type === "sort" || type === "filter" || type === "type")
            return data || "";
          return escapeHtml((data || "-").toUpperCase());
        },
        width: "80px",
      },
      {
        targets: 6,
        data: "speaker_type",
        render: function (data) {
          return escapeHtml(data || "-");
        },
        width: "80px",
      },
      {
        targets: 7,
        data: "sex",
        render: function (data) {
          return escapeHtml(data || "-");
        },
        width: "80px",
      },
      {
        targets: 8,
        data: "mode",
        render: function (data) {
          return escapeHtml(data || "-");
        },
        width: "80px",
      },
      {
        targets: 9,
        data: "discourse",
        render: function (data) {
          return escapeHtml(data || "-");
        },
        width: "80px",
      },
      {
        targets: 10,
        data: "token_id",
        render: function (data) {
          return escapeHtml(data || "-");
        },
        width: "100px",
      },
      {
        targets: 11,
        data: "filename",
        render: function (data, type, row) {
          return renderFileLink(data, type, row);
        },
        width: "80px",
        className: "center-align",
      },
    ],
    language: {
      lengthMenu: "_MENU_ resultados por página",
      zeroRecords: "No se encontraron resultados",
      info: "Mostrando _START_ a _END_ de _TOTAL_ resultados",
      infoEmpty: "Sin resultados",
      infoFiltered: "(filtrados de _MAX_ resultados totales)",
      loadingRecords: "Cargando...",
      processing: "Procesando...",
      paginate: {
        first: "Primero",
        last: "Último",
        next: "Siguiente",
        previous: "Anterior",
      },
    },
  };
}
