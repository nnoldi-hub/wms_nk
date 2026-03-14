/**
 * Faza 2.3 — Validare Configuratie: Reguli ↔ Harta
 *
 * Aceasta pagina ruleaza un audit complet al configuratiei WMS si arata:
 *  - Erori critice (rosu) care blocheaza operatiunile
 *  - Avertismente (portocaliu) care pot cauza probleme
 *  - Sugestii (albastru) pentru imbunatatire
 *  - Statistici generale: zone, reguli, locatii
 */

import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Alert, Button, Chip, Divider,
  CircularProgress, Stack, Accordion, AccordionSummary, AccordionDetails,
  Tooltip, IconButton,
} from '@mui/material';
import {
  CheckCircle as OkIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Lightbulb as SuggestionIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  Warehouse as WarehouseIcon,
  Rule as RuleIcon,
  LocationOn as LocationIcon,
  PlayArrow as RunIcon,
} from '@mui/icons-material';
import warehouseConfigService from '../services/warehouseConfig.service';

// ─── Tipuri ──────────────────────────────────────────────────────────────────

interface ValidationIssue {
  type: string;
  message: string;
  zone_id?: string;
  zone_code?: string;
  zone_type?: string;
  warehouse_name?: string;
  warehouse_id?: string;
  rule_id?: string;
  rule_names?: string[];
  rule_type?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationIssue[];
  stats: {
    total_rules: number;
    total_active_rules: number;
    putaway_rules: number;
    picking_rules: number;
    total_zones: number;
    total_locations: number;
    warehouses_count: number;
    errors_count: number;
    warnings_count: number;
    suggestions_count: number;
  };
  validated_at: string;
}

// ─── Sub-componente ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ valid: boolean; errors: number; warnings: number }> = ({ errors, warnings }) => {
  if (errors > 0) {
    return (
      <Chip
        icon={<ErrorIcon />}
        label={`${errors} erori critice`}
        color="error"
        size="medium"
        sx={{ fontWeight: 700, fontSize: '0.9rem', px: 1 }}
      />
    );
  }
  if (warnings > 0) {
    return (
      <Chip
        icon={<WarningIcon />}
        label={`${warnings} avertismente`}
        color="warning"
        size="medium"
        sx={{ fontWeight: 700, fontSize: '0.9rem', px: 1 }}
      />
    );
  }
  return (
    <Chip
      icon={<OkIcon />}
      label="Configuratie valida"
      color="success"
      size="medium"
      sx={{ fontWeight: 700, fontSize: '0.9rem', px: 1 }}
    />
  );
};

const IssueList: React.FC<{
  title: string;
  issues: ValidationIssue[];
  severity: 'error' | 'warning' | 'info';
  icon: React.ReactNode;
}> = ({ title, issues, severity, icon }) => {
  if (issues.length === 0) return null;

  const colors = {
    error: '#fdecea',
    warning: '#fff3e0',
    info: '#e3f2fd',
  };
  const borderColors = {
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196f3',
  };

  return (
    <Accordion defaultExpanded sx={{ mb: 1, border: `1px solid ${borderColors[severity]}`, borderRadius: '8px !important' }}>
      <AccordionSummary expandIcon={<ExpandIcon />} sx={{ bgcolor: colors[severity], borderRadius: '8px' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {icon}
          <Typography fontWeight={700}>{title}</Typography>
          <Chip label={issues.length} size="small" color={severity === 'info' ? 'info' : severity} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        {issues.map((issue, idx) => (
          <Box key={idx} sx={{ px: 2, py: 1.5, borderTop: idx > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ minWidth: 8, mt: 0.7 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: borderColors[severity] }} />
              </Box>
              <Box flex={1}>
                <Typography variant="body2" sx={{ color: '#333', lineHeight: 1.5 }}>
                  {issue.message}
                </Typography>
                <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap">
                  {issue.zone_code && (
                    <Chip label={`Zona: ${issue.zone_code}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                  )}
                  {issue.zone_type && (
                    <Chip label={issue.zone_type} size="small" variant="outlined" color="default" sx={{ fontSize: '0.7rem' }} />
                  )}
                  {issue.rule_type && (
                    <Chip label={`Regula: ${issue.rule_type}`} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                  )}
                  {issue.warehouse_name && (
                    <Chip label={issue.warehouse_name} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                  )}
                </Stack>
                {issue.rule_names && issue.rule_names.length > 0 && (
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    Reguli: {issue.rule_names.join(', ')}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>
        ))}
      </AccordionDetails>
    </Accordion>
  );
};

const StatCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <Paper elevation={2} sx={{ p: 2, borderRadius: 2, borderLeft: `4px solid ${color}`, minWidth: 130 }}>
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Box sx={{ color }}>{icon}</Box>
      <Box>
        <Typography variant="h5" fontWeight={700} sx={{ color, lineHeight: 1 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Stack>
  </Paper>
);

// ─── Pagina principala ────────────────────────────────────────────────────────

const RulesValidationPage: React.FC = () => {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const runValidation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await warehouseConfigService.validateConfig();
      if (response?.success) {
        setResult(response.data);
        setHasRun(true);
      } else {
        setError('Raspuns invalid de la server');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Eroare la validare');
    } finally {
      setLoading(false);
    }
  }, []);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ro-RO');
    } catch {
      return iso;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="primary">
            Validare Configuratie WMS
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            Verifica consistenta intre regulile de business, hartile de depozit si locatii
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {result && (
            <Tooltip title="Ruleaza din nou">
              <IconButton onClick={runValidation} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <RunIcon />}
            onClick={runValidation}
            disabled={loading}
            sx={{ fontWeight: 700, px: 3 }}
          >
            {loading ? 'Se valideaza...' : 'Ruleaza validarea'}
          </Button>
        </Stack>
      </Stack>

      {/* Stare initiala — inainte de prima rulare */}
      {!hasRun && !loading && (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3, bgcolor: '#f8f9fa' }}>
          <RuleIcon sx={{ fontSize: 64, color: 'primary.light', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Nicio validare rulata inca
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Apasa "Ruleaza validarea" pentru a verifica configuratia WMS:
            reguli active, zone configurate, locatii disponibile si consistenta dintre ele.
          </Typography>
          <Button variant="outlined" size="large" startIcon={<RunIcon />} onClick={runValidation}>
            Incepe validarea
          </Button>
        </Paper>
      )}

      {/* Eroare de network */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Rezultate */}
      {result && !loading && (
        <>
          {/* Banner stare */}
          <Paper
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: 2,
              bgcolor: result.valid ? '#f1f8e9' : '#fdecea',
              border: `1px solid ${result.valid ? '#aed581' : '#f44336'}`,
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
              <Stack direction="row" alignItems="center" spacing={2}>
                {result.valid ? (
                  <OkIcon sx={{ color: '#4caf50', fontSize: 40 }} />
                ) : (
                  <ErrorIcon sx={{ color: '#f44336', fontSize: 40 }} />
                )}
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {result.valid ? 'Configuratia este valida' : 'Configuratia are probleme critice'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Validat la: {formatDate(result.validated_at)}
                  </Typography>
                </Box>
              </Stack>
              <StatusBadge
                valid={result.valid}
                errors={result.stats.errors_count}
                warnings={result.stats.warnings_count}
              />
            </Stack>
          </Paper>

          {/* Statistici */}
          <Typography variant="subtitle1" fontWeight={700} mb={1.5} color="text.secondary">
            Statistici configuratie
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <StatCard label="Depozite" value={result.stats.warehouses_count} icon={<WarehouseIcon />} color="#5c6bc0" />
            <StatCard label="Zone active" value={result.stats.total_zones} icon={<LocationIcon />} color="#26a69a" />
            <StatCard label="Locatii" value={result.stats.total_locations} icon={<LocationIcon />} color="#42a5f5" />
            <StatCard label="Reguli active" value={result.stats.total_active_rules} icon={<RuleIcon />} color="#ab47bc" />
            <StatCard label="Reguli PUTAWAY" value={result.stats.putaway_rules} icon={<RuleIcon />} color="#ff7043" />
            <StatCard label="Reguli PICKING" value={result.stats.picking_rules} icon={<RuleIcon />} color="#66bb6a" />
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Liste probleme */}
          {result.stats.errors_count === 0 && result.stats.warnings_count === 0 && result.stats.suggestions_count === 0 && (
            <Alert severity="success" icon={<OkIcon />} sx={{ mb: 2 }}>
              Nu au fost gasite probleme. Configuratia WMS este completa si consistenta.
            </Alert>
          )}

          <IssueList
            title="Erori critice"
            issues={result.errors}
            severity="error"
            icon={<ErrorIcon color="error" />}
          />
          <IssueList
            title="Avertismente"
            issues={result.warnings}
            severity="warning"
            icon={<WarningIcon color="warning" />}
          />
          <IssueList
            title="Sugestii de imbunatatire"
            issues={result.suggestions}
            severity="info"
            icon={<SuggestionIcon color="info" />}
          />

          {/* Link-uri rapide */}
          {(result.stats.errors_count > 0 || result.stats.warnings_count > 0) && (
            <Paper sx={{ p: 2, mt: 3, borderRadius: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>
                Rezolvare rapida
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                {result.errors.some(e => e.type.includes('RULE')) && (
                  <Button variant="outlined" size="small" href="#/warehouse-config/rules">
                    Gestioneaza reguli
                  </Button>
                )}
                {result.warnings.some(w => w.type.includes('ZONE')) && (
                  <Button variant="outlined" size="small" href="#/warehouse-config/map">
                    Editeaza harta depozit
                  </Button>
                )}
                {result.warnings.some(w => w.type.includes('LOCATION')) && (
                  <Button variant="outlined" size="small" href="#/warehouse-config/locations">
                    Gestioneaza locatii
                  </Button>
                )}
              </Stack>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default RulesValidationPage;
