// SupportDesk frontend – taler med backend udelukkende gennem HTTP (fetch).
// Central handling: se sager, vælge medarbejder, overtage ledig sag, ændre status.

const API = '/api';

// ---------- småhjælpere ----------
const $ = (id) => document.getElementById(id);
const employeeSelect = $('employee-select');
const ticketList = $('ticket-list');
const messageArea = $('message-area');

const STATUS_LABELS = {
  open: 'Åben',
  in_progress: 'Under behandling',
  closed: 'Afsluttet',
};

// HTTP-kald med fælles fejlhåndtering: API'ets res.body.error bruges,
// og netværksfejl fanges, så siden aldrig "går ned".
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* svaret var ikke JSON – håndteres som generisk fejl herunder */
  }
  if (!res.ok) {
    throw new Error(data?.error ?? `Handlingen mislykkedes (HTTP ${res.status})`);
  }
  return data;
}

function showMessage(text, type = 'success') {
  messageArea.textContent = text;
  messageArea.className = `message ${type}`;
}

function hideMessage() {
  messageArea.classList.add('hidden');
}

// ---------- data + rendering ----------
let employees = [];
let tickets = [];

async function loadEmployees() {
  employees = await api('/employees');
  employeeSelect.innerHTML = employees
    .map((e) => `<option value="${e._id}">${e.name}</option>`)
    .join('');
}

async function loadTickets() {
  const params = new URLSearchParams();
  const statusFilter = $('status-filter').value;
  if (statusFilter) params.set('status', statusFilter);
  const qs = params.toString() ? `?${params}` : '';
  tickets = await api(`/tickets${qs}`);
  renderTickets();
}

function renderTickets() {
  const needle = $('filter-input').value.trim().toLowerCase();
  const visible = tickets.filter((t) => !needle || t.title.toLowerCase().includes(needle));

  if (visible.length === 0) {
    ticketList.innerHTML = '<p>Ingen sager matcher.</p>';
    return;
  }

  ticketList.innerHTML = visible.map((t) => {
    const assignee = t.assignedTo;
    const claimedByMe = assignee && assignee._id === employeeSelect.value;
    const statusBadge = `<span class="badge ${t.status}">${STATUS_LABELS[t.status]}</span>`;
    const ownerBadge = assignee
      ? `<span class="badge claimed">Ansvarlig: ${assignee.name}</span>`
      : '<span class="badge free">Ledig sag</span>';

    let actions = '';
    if (!assignee && t.status !== 'closed') {
      actions = `<button class="primary" data-action="claim" data-id="${t._id}">Overtag sagen</button>`;
    } else if (claimedByMe && t.status !== 'closed') {
      if (t.status === 'open') {
        actions = `<button class="primary" data-action="status" data-id="${t._id}" data-status="in_progress">Start behandling</button>`;
      } else if (t.status === 'in_progress') {
        actions = `<button class="primary" data-action="status" data-id="${t._id}" data-status="closed">Afslut sagen</button>`;
      }
    }

    return `
      <article class="ticket-card" data-id="${t._id}">
        <div class="ticket-info">
          <h3>${escapeHtml(t.title)}</h3>
          <p class="category">${escapeHtml(t.category)} · sag nr. ${t._id.slice(-6)}</p>
          <p>${escapeHtml(t.description)}</p>
          <p>${statusBadge} ${ownerBadge}</p>
        </div>
        <div class="ticket-actions">${actions}</div>
      </article>`;
  }).join('');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- handlinger ----------
async function claimTicket(ticketId) {
  const employeeId = employeeSelect.value;
  try {
    const result = await api('/assignments', {
      method: 'POST',
      body: { ticketId, employeeId },
    });
    showMessage(result.message, 'success');
    await loadTickets();
  } catch (err) {
    showMessage(err.message, 'error'); // f.eks. "allerede overtaget af en anden"
    await loadTickets(); // vis den opdaterede virkelighed
  }
}

async function changeStatus(ticketId, status) {
  const employeeId = employeeSelect.value;
  try {
    const updated = await api(`/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: { status, employeeId },
    });
    showMessage(`Status opdateret til "${STATUS_LABELS[updated.status]}".`, 'success');
    await loadTickets();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

// ---------- events ----------
ticketList.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  hideMessage();
  if (btn.dataset.action === 'claim') claimTicket(btn.dataset.id);
  if (btn.dataset.action === 'status') changeStatus(btn.dataset.id, btn.dataset.status);
});

$('refresh-btn').addEventListener('click', () => { hideMessage(); loadTickets(); });
$('filter-input').addEventListener('input', renderTickets);
$('status-filter').addEventListener('change', () => { hideMessage(); loadTickets(); });
employeeSelect.addEventListener('change', renderTickets);

// ---------- start ----------
(async () => {
  try {
    await loadEmployees();
    await loadTickets();
  } catch (err) {
    showMessage(`Kunne ikke kontakte SupportDesk-API'et: ${err.message}`, 'error');
  }
})();
