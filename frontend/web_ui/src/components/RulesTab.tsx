import { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Stack, Typography, Alert, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel, Switch,
  FormControlLabel, Snackbar, Tabs, Tab,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import warehouseConfigService from '../services/warehouseConfig.service';

// ─── Tipuri ──────────────────────────────────────────────────────────────────

interface WmsRule {
  id: string;
  name: string;
  description?: string;
  scope: string;
  rule_type: string;
  priority: number;
  is_active: boolean;
  conditions: unknown[];
  actions: unknown[];
  created_at: string;
}

interface RuleFormState {
  name: string;
  description: string;
  scope: string;
  rule_type: string;
  priority: number;
  is_active: boolean;
  conditions_json: string;
  actions_json: string;
}

const SCOPES = ['PUTAWAY', 'PICKING', 'RECEIVING', 'CUTTING', 'SHIPPING', 'GENERAL'];

const SCOPE_LABELS: Record<string, string> = {
  ALL: 'Toate',
  PUTAWAY: 'Aranjare',
  PICKING: 'Picking',
  RECEIVING: 'Recepție',
  CUTTING: 'Tăiere',
  SHIPPING: 'Livrare',
  GENERAL: 'General',
};

const RULE_TYPES_BY_SCOPE: Record<string, string[]> = {
  PICKING: ['FIFO', 'FEFO', 'LIFO', 'USE_REMAINS_FIRST', 'MIN_WASTE', 'LOCATION_PROXIMITY', 'ZONE_PREFERENCE'],
  PUTAWAY: ['ZONE_PREFERENCE', 'LOCATION_TYPE_PREFERENCE', 'WEIGHT_LIMIT', 'CATEGORY_RESTRICTION'],
  RECEIVING: ['ZONE_PREFERENCE', 'REQUIRE_APPROVAL', 'AUTO_ASSIGN'],
  CUTTING: ['MIN_WASTE', 'MAXIMIZE_USAGE'],
  SHIPPING: ['ZONE_PREFERENCE', 'CARRIER_PREFERENCE'],
  GENERAL: ['CUSTOM'],
};

const SCOPE_COLORS: Record<string, 'default'|'primary'|'secondary'|'error'|'info'|'success'|'warning'> = {
  PUTAWAY: 'success',
  PICKING: 'primary',
  RECEIVING: 'info',
  CUTTING: 'warning',
  SHIPPING: 'error',
  GENERAL: 'default',
};

const DEFAULT_CONDITIONS: Record<string, unknown[]> = {
  FIFO: [],
  FEFO: [],
  USE_REMAINS_FIRST: [{ field: 'stock.lot_status', operator: 'IN', value: ['CUT', 'PARTIAL'] }],
  MIN_WASTE: [],
  ZONE_PREFERENCE: [{ field: 'product.category', operator: '=', value: '' }],
  CATEGORY_RESTRICTION: [{ field: 'product.category', operator: 'IN', value: [] }],
};

const DEFAULT_ACTIONS: Record<string, unknown[]> = {
  FIFO: [{ type: 'PICK_STRATEGY', value: 'FIFO' }],
  FEFO: [{ type: 'PICK_STRATEGY', value: 'FEFO' }],
  USE_REMAINS_FIRST: [{ type: 'PICK_STRATEGY', value: 'USE_REMAINS_FIRST' }],
  MIN_WASTE: [{ type: 'PICK_STRATEGY', value: 'MIN_WASTE' }],
  ZONE_PREFERENCE: [{ type: 'SUGGEST_ZONE', value: '' }],
  CATEGORY_RESTRICTION: [{ type: 'BLOCK_OPERATION', reason: 'Categorie nepermisă în această locație' }],
};

const emptyForm = (): RuleFormState => ({
  name: '',
  description: '',
  scope: 'PICKING',
  rule_type: 'FIFO',
  priority: 50,
  is_active: true,
  conditions_json: '[]',
  actions_json: '[{"type":"PICK_STRATEGY","value":"FIFO"}]',
});

// ─── Componenta principală ────────────────────────────────────────────────────

export function RulesTab() {
  const [rules, setRules] = useState<WmsRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState(0); // 0 = toate
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<WmsRule | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm());
  const [jsonError, setJsonError] = useState<{ conditions?: string; actions?: string }>({});
  const [openEval, setOpenEval] = useState(false);
  const [evalRule, setEvalRule] = useState<WmsRule | null>(null);
  const [evalContext, setEvalContext] = useState('{\n  "product": {"category": "cable"},\n  "stock": {"lot_status": "INTACT"},\n  "location": {}\n}');
  const [evalResult, setEvalResult] = useState<Record<string, unknown> | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<WmsRule | null>(null);
  const [openReorder, setOpenReorder] = useState(false);
  const [reorderList, setReorderList] = useState<WmsRule[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);

  const scopesList = ['ALL', ...SCOPES];

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const scope = scopesList[scopeFilter] === 'ALL' ? undefined : scopesList[scopeFilter];
      const resp = await warehouseConfigService.listRules(scope ? { scope } : undefined);
      setRules(resp.data || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeFilter]);

  useEffect(() => { loadRules(); }, [loadRules]);

  // ── Populare template automat la schimbare rule_type ──
  const handleRuleTypeChange = (rt: string) => {
    const cond = DEFAULT_CONDITIONS[rt] ?? [];
    const act = DEFAULT_ACTIONS[rt] ?? [];
    setForm(f => ({
      ...f,
      rule_type: rt,
      conditions_json: JSON.stringify(cond, null, 2),
      actions_json: JSON.stringify(act, null, 2),
    }));
    setJsonError({});
  };

  const validateJson = (field: 'conditions_json' | 'actions_json'): boolean => {
    try {
      JSON.parse(form[field]);
      setJsonError(e => ({ ...e, [field === 'conditions_json' ? 'conditions' : 'actions']: undefined }));
      return true;
    } catch {
      setJsonError(e => ({ ...e, [field === 'conditions_json' ? 'conditions' : 'actions']: 'JSON invalid' }));
      return false;
    }
  };

  const openCreate = () => {
    setEditingRule(null);
    setForm(emptyForm());
    setJsonError({});
    setOpenDialog(true);
  };

  const openEdit = (rule: WmsRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      description: rule.description || '',
      scope: rule.scope,
      rule_type: rule.rule_type,
      priority: rule.priority,
      is_active: rule.is_active,
      conditions_json: JSON.stringify(rule.conditions ?? [], null, 2),
      actions_json: JSON.stringify(rule.actions ?? [], null, 2),
    });
    setJsonError({});
    setOpenDialog(true);
  };

  const handleSave = async () => {
    const c1 = validateJson('conditions_json');
    const c2 = validateJson('actions_json');
    if (!c1 || !c2) return;
    if (!form.name.trim()) { setError('Numele regulii este obligatoriu'); return; }

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || undefined,
        scope: form.scope,
        rule_type: form.rule_type,
        priority: form.priority,
        is_active: form.is_active,
        conditions: JSON.parse(form.conditions_json),
        actions: JSON.parse(form.actions_json),
      };

      if (editingRule) {
        await warehouseConfigService.updateRule(editingRule.id, payload);
        setSuccess('Regulă actualizată');
      } else {
        await warehouseConfigService.createRule(payload);
        setSuccess('Regulă creată');
      }
      setOpenDialog(false);
      await loadRules();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (rule: WmsRule) => {
    try {
      await warehouseConfigService.deleteRule(rule.id);
      setSuccess('Regulă ștearsă');
      setDeleteConfirm(null);
      await loadRules();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleToggleActive = async (rule: WmsRule) => {
    try {
      await warehouseConfigService.updateRule(rule.id, { is_active: !rule.is_active });
      await loadRules();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openReorderDialog = () => {
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    setReorderList(sorted);
    setOpenReorder(true);
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    const newList = [...reorderList];
    const target = index + direction;
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setReorderList(newList);
  };

  const saveReorder = async () => {
    setReorderSaving(true);
    try {
      const updates = reorderList.map((r, i) => ({ id: r.id, priority: (i + 1) * 10 }));
      await warehouseConfigService.reorderRules(updates);
      setSuccess('Priorități actualizate');
      setOpenReorder(false);
      await loadRules();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReorderSaving(false);
    }
  };

  const handleEvaluate = async () => {
    if (!evalRule) return;
    try {
      const context = JSON.parse(evalContext);
      const result = await warehouseConfigService.evaluateRule({
        rule_id: evalRule.id,
        scope: evalRule.scope,
        context,
      });
      setEvalResult(result);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ── Coloane DataGrid ──
  const columns: GridColDef[] = [
    { field: 'priority', headerName: 'P.', width: 55, type: 'number' },
    {
      field: 'scope', headerName: 'Scope', width: 110,
      renderCell: (p) => <Chip label={p.value} color={SCOPE_COLORS[p.value] || 'default'} size="small" />,
    },
    { field: 'rule_type', headerName: 'Tip regulă', width: 180 },
    { field: 'name', headerName: 'Nume', flex: 1, minWidth: 200 },
    {
      field: 'is_active', headerName: 'Activ', width: 80,
      renderCell: (p) => (
        <Switch
          checked={p.value as boolean}
          size="small"
          onChange={() => handleToggleActive(p.row as WmsRule)}
          color="success"
        />
      ),
    },
    {
      field: 'actions_col', headerName: '', width: 110, sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Testează">
            <IconButton size="small" color="info" onClick={() => { setEvalRule(p.row as WmsRule); setEvalResult(null); setOpenEval(true); }}>
              <PlayArrowIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Editează">
            <IconButton size="small" onClick={() => openEdit(p.row as WmsRule)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Șterge">
            <IconButton size="small" color="error" onClick={() => setDeleteConfirm(p.row as WmsRule)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const availableRuleTypes = RULE_TYPES_BY_SCOPE[form.scope] ?? ['CUSTOM'];

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* ── Filtre scope ── */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Tabs
          value={scopeFilter}
          onChange={(_, v) => setScopeFilter(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {scopesList.map((s) => <Tab key={s} label={SCOPE_LABELS[s] ?? s} />)}
        </Tabs>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" startIcon={<FormatListNumberedIcon />} onClick={openReorderDialog}>
          Reordonează
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Regulă Nouă
        </Button>
      </Stack>

      {/* ── Grid reguli ── */}
      <DataGrid
        rows={rules}
        columns={columns}
        loading={loading}
        autoHeight
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        disableRowSelectionOnClick
        sx={{ mb: 3 }}
        getRowId={(r) => r.id}
      />

      {/* ── Dialog creare/editare ── */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingRule ? 'Editează Regulă' : 'Regulă Nouă'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Nume regulă *"
                fullWidth
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <TextField
                label="Prioritate"
                type="number"
                sx={{ width: 120 }}
                value={form.priority}
                onChange={(e) => setForm(f => ({ ...f, priority: +e.target.value }))}
                inputProps={{ min: 1, max: 999 }}
              />
            </Stack>

            <TextField
              label="Descriere"
              multiline
              rows={2}
              fullWidth
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            />

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Scope</InputLabel>
                <Select
                  value={form.scope}
                  label="Scope"
                  onChange={(e) => {
                    const newScope = e.target.value as string;
                    const firstType = (RULE_TYPES_BY_SCOPE[newScope] ?? ['CUSTOM'])[0];
                    setForm(f => ({ ...f, scope: newScope, rule_type: firstType }));
                  }}
                >
                  {SCOPES.map(s => <MenuItem key={s} value={s}>{SCOPE_LABELS[s] ?? s}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Tip Regulă</InputLabel>
                <Select
                  value={form.rule_type}
                  label="Tip Regulă"
                  onChange={(e) => handleRuleTypeChange(e.target.value as string)}
                >
                  {availableRuleTypes.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_active}
                    onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    color="success"
                  />
                }
                label="Activă"
                sx={{ minWidth: 90 }}
              />
            </Stack>

            {/* ── Condiții JSON ── */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Condiții (JSON array) — ex: [{'{'}„field":"product.category","operator":"=","value":"cable"{'}'}]
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={5}
                value={form.conditions_json}
                onChange={(e) => setForm(f => ({ ...f, conditions_json: e.target.value }))}
                onBlur={() => validateJson('conditions_json')}
                error={!!jsonError.conditions}
                helperText={jsonError.conditions || 'Câmp, operator, valoare pentru fiecare condiție'}
                inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              />
            </Box>

            {/* ── Acțiuni JSON ── */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Acțiuni (JSON array) — ex: [{'{'}„type":"SUGGEST_ZONE","value":"TAMBURI"{'}'}]
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={form.actions_json}
                onChange={(e) => setForm(f => ({ ...f, actions_json: e.target.value }))}
                onBlur={() => validateJson('actions_json')}
                error={!!jsonError.actions}
                helperText={jsonError.actions || 'Tipuri: PICK_STRATEGY, SUGGEST_ZONE, SUGGEST_LOCATION, BLOCK_OPERATION'}
                inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              />
            </Box>

            {/* ── Referință rapidă operatori ── */}
            <Alert severity="info" sx={{ fontSize: 12 }}>
              <strong>Operatori condiții:</strong> = | != | &gt; | &gt;= | &lt; | &lt;= | IN | NOT_IN | CONTAINS | STARTS_WITH | IS_NULL | IS_NOT_NULL<br />
              <strong>Câmpuri context:</strong> product.category | product.weight_kg | stock.lot_status | stock.quantity | location.zone_code | location.type_code<br />
              <strong>Tipuri acțiuni:</strong> PICK_STRATEGY | SUGGEST_ZONE | SUGGEST_LOCATION | BLOCK_OPERATION | REQUIRE_APPROVAL
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Anulează</Button>
          <Button variant="contained" onClick={handleSave}>
            {editingRule ? 'Salvează' : 'Creează'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog testare regulă ── */}
      <Dialog open={openEval} onClose={() => setOpenEval(false)} maxWidth="md" fullWidth>
        <DialogTitle>Testează Regulă: {evalRule?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Context JSON (valorile pe care le verifică regula):
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={7}
                value={evalContext}
                onChange={(e) => setEvalContext(e.target.value)}
                inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              />
            </Box>
            {evalResult !== null && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Rezultat evaluare:
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    bgcolor: 'grey.900', color: 'success.light', p: 2, borderRadius: 1,
                    fontSize: 12, overflow: 'auto', maxHeight: 300,
                  }}
                >
                  {JSON.stringify(evalResult, null, 2)}
                </Box>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEval(false)}>Închide</Button>
          <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={handleEvaluate}>
            Rulează
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog confirmare ștergere ── */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>Confirmare ștergere</DialogTitle>
        <DialogContent>
          <Typography>
            Ștergi regula <strong>{deleteConfirm?.name}</strong>? Această acțiune nu poate fi anulată.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Anulează</Button>
          <Button color="error" variant="contained" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
            Șterge
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog reordonare priorități ── */}
      <Dialog open={openReorder} onClose={() => setOpenReorder(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reordonează Priorități Reguli</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Folosește săgețile pentru a schimba ordinea. Prioritatea va fi recalculată automat (10, 20, 30, ...).
          </Typography>
          <Stack spacing={1}>
            {reorderList.map((rule, i) => (
              <Box
                key={rule.id}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                  bgcolor: rule.is_active ? 'inherit' : 'action.hover',
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ width: 28, textAlign: 'right', flexShrink: 0 }}>
                  {(i + 1) * 10}
                </Typography>
                <Chip label={rule.scope} size="small" color={SCOPE_COLORS[rule.scope] || 'default'} sx={{ flexShrink: 0 }} />
                <Typography variant="body2" sx={{ flex: 1 }}>{rule.name}</Typography>
                {!rule.is_active && <Chip label="inactiv" size="small" variant="outlined" />}
                <IconButton size="small" onClick={() => moveRule(i, -1)} disabled={i === 0}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => moveRule(i, 1)} disabled={i === reorderList.length - 1}>
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReorder(false)}>Anulează</Button>
          <Button variant="contained" onClick={saveReorder} disabled={reorderSaving}>
            {reorderSaving ? 'Salvez...' : 'Salvează Ordinea'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar success ── */}
      <Snackbar
        open={!!success}
        autoHideDuration={2500}
        onClose={() => setSuccess(null)}
        message={success || ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        ContentProps={{ style: { backgroundColor: '#2e7d32' } }}
      />
    </Box>
  );
}

export default RulesTab;
