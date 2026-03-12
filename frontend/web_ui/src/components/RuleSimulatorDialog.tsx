import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, TextField, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Typography, Chip, Box, Divider,
  Accordion, AccordionSummary, AccordionDetails, Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { warehouseConfigService } from '../services/warehouseConfig.service';

const SCOPE_LABELS: Record<string, string> = {
  PICKING: 'Picking',
  PUTAWAY: 'Depozitare',
  RECEIVING: 'Recepție',
  CUTTING: 'Croitorie',
  SHIPPING: 'Expediere',
  GENERAL: 'General',
};

const SCOPES = Object.keys(SCOPE_LABELS);

const EXAMPLES: { label: string; scope: string; context: Record<string, unknown> }[] = [
  {
    label: 'Cablu lung, FIFO',
    scope: 'PICKING',
    context: { product_type: 'cablu', length_m: 150, quantity: 5, zone_type: 'STANDARD', is_fragile: false },
  },
  {
    label: 'Rest mic cablu',
    scope: 'PICKING',
    context: { product_type: 'cablu', length_m: 3, quantity: 1, zone_type: 'STANDARD', is_fragile: false },
  },
  {
    label: 'Tambur mare',
    scope: 'PUTAWAY',
    context: { product_type: 'tambur', weight_kg: 200, height_cm: 120, zone_type: 'HEAVY', is_fragile: false },
  },
  {
    label: 'Recepție standard',
    scope: 'RECEIVING',
    context: { product_type: 'cablu', quantity: 20, supplier_type: 'REGULAR' },
  },
];

interface ConditionResult {
  field: string;
  operator: string;
  expected: unknown;
  actual_value: unknown;
  passed: boolean;
  reason: string | null;
}

interface RuleResult {
  rule_id: string;
  rule_name: string;
  rule_type: string;
  priority: number;
  is_active: boolean;
  matched: boolean;
  conditions_evaluated: ConditionResult[];
  actions: { type: string; value: unknown }[];
  no_conditions: boolean;
}

interface SimulateResponse {
  success: boolean;
  scope: string;
  total_rules: number;
  matched_count: number;
  rules: RuleResult[];
  final_actions: { type: string; value: unknown; from_rule: string }[];
  fallback_applied: boolean;
  fallback_strategy: string | null;
}

interface ConflictEntry {
  type: string;
  severity: 'ERROR' | 'WARNING';
  scope: string;
  message: string;
  rule_ids?: string[];
  rule_names?: string[];
  action_type?: string;
  entries?: { rule_name: string; value: unknown; priority: number }[];
}

interface ConflictsResponse {
  success: boolean;
  total_conflicts: number;
  has_errors: boolean;
  conflicts: ConflictEntry[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RuleSimulatorDialog({ open, onClose }: Props) {
  const [scope, setScope] = useState('PICKING');
  const [contextText, setContextText] = useState(
    JSON.stringify({ product_type: 'cablu', length_m: 100, quantity: 3, zone_type: 'STANDARD' }, null, 2)
  );
  const [includeInactive, setIncludeInactive] = useState(false);
  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [conflicts, setConflicts] = useState<ConflictsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyExample(ex: typeof EXAMPLES[0]) {
    setScope(ex.scope);
    setContextText(JSON.stringify(ex.context, null, 2));
    setResult(null);
    setError(null);
  }

  async function runSimulation() {
    setError(null);
    setResult(null);
    let ctx: Record<string, unknown>;
    try {
      ctx = JSON.parse(contextText);
    } catch {
      setError('JSON context invalid — verificați sintaxa');
      return;
    }
    setLoading(true);
    try {
      const res = await warehouseConfigService.simulateRules({ scope, context: ctx, include_inactive: includeInactive });
      setResult(res);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Eroare la simulare';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function runDetectConflicts() {
    setConflicts(null);
    setConflictsLoading(true);
    try {
      const res = await warehouseConfigService.detectRuleConflicts(scope);
      setConflicts(res);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Eroare detectare conflicte';
      setError(msg);
    } finally {
      setConflictsLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { height: '90vh' } }}>
      <DialogTitle sx={{ pb: 1 }}>
        🎮 Simulator Reguli WMS
        <Typography variant="body2" color="text.secondary">
          Testează cum se aplică regulile pentru un context dat
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* ── Configurare ── */}
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Scope</InputLabel>
            <Select value={scope} label="Scope" onChange={e => { setScope(e.target.value); setResult(null); setConflicts(null); }}>
              {SCOPES.map(s => <MenuItem key={s} value={s}>{SCOPE_LABELS[s]}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Reguli incluse</InputLabel>
            <Select value={includeInactive ? 'all' : 'active'} label="Reguli incluse"
              onChange={e => setIncludeInactive(e.target.value === 'all')}>
              <MenuItem value="active">Doar active</MenuItem>
              <MenuItem value="all">Active + inactive</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {/* ── Exemple rapide ── */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Exemple rapide:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {EXAMPLES.map(ex => (
              <Chip key={ex.label} label={ex.label} size="small" variant="outlined" clickable onClick={() => applyExample(ex)} />
            ))}
          </Stack>
        </Box>

        {/* ── Editor JSON context ── */}
        <TextField
          label="Context JSON"
          multiline
          rows={7}
          fullWidth
          value={contextText}
          onChange={e => { setContextText(e.target.value); setResult(null); }}
          sx={{ fontFamily: 'monospace' }}
          inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
        />

        {error && <Alert severity="error">{error}</Alert>}

        {/* ── Rezultate simulare ── */}
        {result && (
          <>
            <Divider />
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle1" fontWeight={600}>
                Rezultate — {result.scope}
              </Typography>
              <Chip label={`${result.total_rules} reguli evaluate`} size="small" />
              <Chip
                label={`${result.matched_count} potrivite`}
                size="small"
                color={result.matched_count > 0 ? 'success' : 'default'}
              />
              {result.fallback_applied && (
                <Chip label={`Fallback: ${result.fallback_strategy}`} size="small" color="warning" icon={<WarningAmberIcon />} />
              )}
            </Stack>

            {/* Acțiuni finale */}
            {result.final_actions.length > 0 && (
              <Box>
                <Typography variant="body2" fontWeight={600} mb={0.5}>Acțiuni finale:</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {result.final_actions.map((a, i) => (
                    <Tooltip key={i} title={`Din regula: ${a.from_rule}`}>
                      <Chip
                        size="small"
                        color="primary"
                        label={`${a.type}: ${JSON.stringify(a.value)}`}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Lista reguli */}
            <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
              {result.rules.map(rule => (
                <Accordion key={rule.rule_id} disableGutters sx={{ mb: 0.5 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', pr: 1 }}>
                      {rule.matched
                        ? <CheckCircleIcon color="success" fontSize="small" />
                        : <CancelIcon color="error" fontSize="small" />}
                      <Typography variant="body2" fontWeight={rule.matched ? 600 : 400} sx={{ flexGrow: 1 }}>
                        {rule.rule_name}
                      </Typography>
                      <Chip label={`P${rule.priority}`} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                      <Chip label={rule.rule_type} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                      {!rule.is_active && <Chip label="inactivă" size="small" color="default" sx={{ fontSize: 11 }} />}
                      {rule.no_conditions && (
                        <Tooltip title="Regulă fără condiții — se aplică întotdeauna">
                          <InfoOutlinedIcon fontSize="small" color="info" />
                        </Tooltip>
                      )}
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 2, py: 1, bgcolor: 'grey.50' }}>
                    {rule.no_conditions ? (
                      <Typography variant="caption" color="text.secondary">
                        Fără condiții — se potrivește întotdeauna când este activă
                      </Typography>
                    ) : (
                      <Stack spacing={0.5}>
                        {rule.conditions_evaluated.map((cond, ci) => (
                          <Stack key={ci} direction="row" spacing={1} alignItems="flex-start">
                            {cond.passed
                              ? <CheckCircleIcon color="success" fontSize="small" sx={{ mt: 0.1 }} />
                              : <CancelIcon color="error" fontSize="small" sx={{ mt: 0.1 }} />}
                            <Box>
                              <Typography variant="caption" fontFamily="monospace">
                                {cond.field} {cond.operator} {JSON.stringify(cond.expected)}
                              </Typography>
                              {!cond.passed && cond.reason && (
                                <Typography variant="caption" display="block" color="error.main">
                                  ↳ {cond.reason}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        ))}
                      </Stack>
                    )}
                    {rule.matched && rule.actions.length > 0 && (
                      <Box mt={1}>
                        <Typography variant="caption" color="text.secondary">Acțiuni:</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" mt={0.5}>
                          {rule.actions.map((a, ai) => (
                            <Chip key={ai} size="small" color="success" variant="outlined"
                              label={`${a.type}: ${JSON.stringify(a.value)}`} />
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </>
        )}

        {/* ── Rezultate conflicte ── */}
        {conflicts && (
          <>
            <Divider />
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" fontWeight={600}>
                Conflicte detectate — {scope}
              </Typography>
              <Chip
                label={conflicts.total_conflicts === 0 ? 'Fără conflicte' : `${conflicts.total_conflicts} conflicte`}
                size="small"
                color={conflicts.total_conflicts === 0 ? 'success' : conflicts.has_errors ? 'error' : 'warning'}
              />
            </Stack>
            {conflicts.total_conflicts === 0 ? (
              <Alert severity="success">Niciun conflict detectat pentru scope-ul {scope}</Alert>
            ) : (
              <Stack spacing={1}>
                {conflicts.conflicts.map((c, i) => (
                  <Alert key={i} severity={c.severity === 'ERROR' ? 'error' : 'warning'}>
                    <Typography variant="body2" fontWeight={600}>{c.type.replace(/_/g, ' ')}</Typography>
                    <Typography variant="body2">{c.message}</Typography>
                    {c.rule_names && (
                      <Typography variant="caption">Reguli: {c.rule_names.join(', ')}</Typography>
                    )}
                    {c.entries && (
                      <Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap">
                        {c.entries.map((e, ei) => (
                          <Chip key={ei} size="small" label={`P${e.priority}: ${e.rule_name} → ${JSON.stringify(e.value)}`} />
                        ))}
                      </Stack>
                    )}
                  </Alert>
                ))}
              </Stack>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        <Button
          variant="outlined"
          color="warning"
          onClick={runDetectConflicts}
          disabled={conflictsLoading}
          startIcon={conflictsLoading ? <CircularProgress size={16} /> : <WarningAmberIcon />}
        >
          Detectează Conflicte
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>Închide</Button>
        <Button
          variant="contained"
          onClick={runSimulation}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          ▶ Rulează Simularea
        </Button>
      </DialogActions>
    </Dialog>
  );
}
