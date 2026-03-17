import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, AppBar, IconButton, Typography, Avatar, Menu, MenuItem, ListSubheader, Divider, Collapse, Tooltip } from '@mui/material';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import ChecklistIcon from '@mui/icons-material/Checklist';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import TransformIcon from '@mui/icons-material/Transform';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import MoveDownIcon from '@mui/icons-material/MoveDown';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import StorageIcon from '@mui/icons-material/Storage';
import CategoryIcon from '@mui/icons-material/Category';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import SpeedIcon from '@mui/icons-material/Speed';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import VerifiedIcon from '@mui/icons-material/Verified';
import ScienceIcon from '@mui/icons-material/Science';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import PalletIcon from '@mui/icons-material/Inventory2';
import ManageHistoryIcon from '@mui/icons-material/ManageHistory';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from './NotificationBell';
import { useTutorial } from '../hooks/useTutorial';

const drawerWidth = 260;

type Role = 'admin' | 'manager' | 'operator';

type MenuItemDef = { text: string; icon: React.ReactNode; path: string; roles?: Role[] };
type MenuGroupDef = { title: string; items: MenuItemDef[]; roles?: Role[] };

// Top-level quick link (optional)
const menuTop: MenuItemDef[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
];

// Grouped navigation matching the new sidebar layout
const menuGroups: MenuGroupDef[] = [
  {
    title: 'Admin',
    roles: ['admin', 'manager'],
    items: [
      { text: 'Setări', icon: <SettingsApplicationsIcon />, path: '/initial-setup', roles: ['admin', 'manager'] },
      { text: 'Configurare Depozit', icon: <WarehouseIcon />, path: '/warehouse-config', roles: ['admin', 'manager'] },
      { text: 'Validare Configuratie', icon: <VerifiedIcon />, path: '/validare-configuratie', roles: ['admin', 'manager'] },
      { text: 'Validator Setup (3.2)', icon: <VerifiedIcon />, path: '/validator-configurare', roles: ['admin', 'manager'] },
      { text: 'Tipuri Locații', icon: <CategoryIcon />, path: '/tipuri-locatii', roles: ['admin', 'manager'] },
      { text: 'Tipuri Ambalaje', icon: <Inventory2Icon />, path: '/tipuri-ambalaje', roles: ['admin', 'manager'] },
      { text: 'Reguli Depozitare', icon: <CallSplitIcon />, path: '/reguli-putaway', roles: ['admin', 'manager'] },
      { text: 'Capacități Locații', icon: <StorageIcon />, path: '/capacitati-locatii', roles: ['admin', 'manager'] },
      { text: 'Wizard Configurare', icon: <SettingsApplicationsIcon />, path: '/wizard-configurare', roles: ['admin', 'manager'] },
      { text: 'Template-uri Depozit', icon: <WarehouseIcon />, path: '/template-depozit', roles: ['admin', 'manager'] },
      { text: 'Simulator WMS', icon: <ScienceIcon />, path: '/simulator-wms', roles: ['admin', 'manager'] },
      { text: 'Reguli Dinamice', icon: <DynamicFeedIcon />, path: '/reguli-dinamice', roles: ['admin', 'manager'] },
      { text: 'Alerte Live', icon: <NotificationsActiveIcon />, path: '/alerte-live', roles: ['admin', 'manager', 'operator'] },
      { text: 'ERP Pluriva', icon: <SyncAltIcon />, path: '/erp-integrare', roles: ['admin', 'manager'] },
      { text: 'Audit Log', icon: <ManageHistoryIcon />, path: '/audit-activitate', roles: ['admin', 'manager'] },
      { text: 'Utilizatori', icon: <PeopleIcon />, path: '/utilizatori', roles: ['admin'] },
      { text: 'Import Stoc Inițial', icon: <FileUploadIcon />, path: '/import-stoc', roles: ['admin', 'manager'] },
      { text: 'QR Coduri Locații', icon: <QrCode2Icon />, path: '/qr-locatii', roles: ['admin', 'manager'] },
      { text: 'Rapoarte Picking', icon: <AssessmentIcon />, path: '/reports', roles: ['admin', 'manager'] },
      { text: 'Etichete Loturi', icon: <TrendingUpIcon />, path: '/etichete-loturi', roles: ['admin', 'manager'] },
    ],
  },
  {
    title: 'Operațiuni',
    roles: ['admin', 'manager', 'operator'],
    items: [
      { text: 'Comenzi Furnizor', icon: <ShoppingCartIcon />, path: '/comenzi-furnizor', roles: ['admin', 'manager'] },
      { text: 'Recepție NIR', icon: <ReceiptLongIcon />, path: '/receptie-nir', roles: ['admin', 'manager', 'operator'] },
      { text: 'Sarcini Depozitare', icon: <MoveDownIcon />, path: '/putaway-tasks', roles: ['admin', 'manager', 'operator'] },
      { text: 'Paleți', icon: <PalletIcon />, path: '/pallets', roles: ['admin', 'manager', 'operator'] },
      { text: 'Produse', icon: <InventoryIcon />, path: '/products', roles: ['admin', 'manager', 'operator'] },
      { text: 'Recepție Marfă', icon: <MoveToInboxIcon />, path: '/receptie', roles: ['admin', 'manager', 'operator'] },
      { text: 'Comenzi Clienți', icon: <ChecklistIcon />, path: '/orders', roles: ['admin', 'manager', 'operator'] },
      { text: 'Culegere', icon: <PlaylistAddCheckIcon />, path: '/pick-jobs', roles: ['admin', 'manager', 'operator'] },
      { text: 'Note de Culegere', icon: <AssignmentIcon />, path: '/note-culegere', roles: ['admin', 'manager', 'operator'] },
      { text: 'Expedieri', icon: <LocalShippingIcon />, path: '/shipments', roles: ['admin', 'manager', 'operator'] },
      { text: 'Livrare Șofer', icon: <DirectionsCarIcon />, path: '/livrare', roles: ['admin', 'manager', 'operator'] },
      // Opțiuni suplimentare (rămân vizibile, dar grupate)
      { text: 'Loturi', icon: <ViewModuleIcon />, path: '/batches', roles: ['admin', 'manager', 'operator'] },
      { text: 'Transformări', icon: <TransformIcon />, path: '/transformations', roles: ['admin', 'manager', 'operator'] },
      { text: 'Scanare', icon: <QrCodeScannerIcon />, path: '/scan', roles: ['admin', 'manager', 'operator'] },
    ],
  },
  {
    title: 'Rapoarte & Analiză',
    roles: ['admin', 'manager'],
    items: [
      { text: 'Mișcări inventar', icon: <SwapHorizIcon />, path: '/rapoarte-miscari', roles: ['admin', 'manager'] },
      { text: 'Stoc & Loturi', icon: <StorageIcon />, path: '/rapoarte-stoc', roles: ['admin', 'manager'] },
      { text: 'Performanță', icon: <SpeedIcon />, path: '/rapoarte-performanta', roles: ['admin', 'manager'] },
      { text: 'Predicții & Forecast', icon: <AutoGraphIcon />, path: '/rapoarte-predictii', roles: ['admin', 'manager'] },
    ],
  },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('menu.openGroups');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { openDrawer } = useTutorial();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawer = (
    <div>
      <Toolbar sx={{ backgroundColor: '#1565c0', color: '#fff' }}>
        <Typography variant="h6" noWrap>
          WMS NK Admin
        </Typography>
      </Toolbar>
      {/* Top quick links */}
      {menuTop.length > 0 && (
        <List>
          {menuTop.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(25, 118, 210, 0.12)',
                    borderLeft: '4px solid #1976d2',
                  },
                }}
              >
                <ListItemIcon sx={{ color: '#fff' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} sx={{ color: '#fff' }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
      <Divider />

      {/* Grouped sections */}
      {menuGroups
        // filter groups by role (group-level and at least one visible item)
        .filter((group) => {
          const role = (user?.role || 'operator') as Role;
          const groupAllowed = !group.roles || group.roles.includes(role);
          const hasVisibleItem = group.items.some((it) => !it.roles || it.roles.includes(role));
          return groupAllowed && hasVisibleItem;
        })
        .map((group) => {
          const role = (user?.role || 'operator') as Role;
          const visibleItems = group.items.filter((it) => !it.roles || it.roles.includes(role));
          const isOpen = (openGroups[group.title] ?? visibleItems.some(i => i.path === location.pathname));
          return (
            <List key={group.title} sx={{ pt: 0 }}>
              <ListSubheader sx={{ bgcolor: 'transparent', color: '#fff', px: 2 }}>
                <ListItemButton onClick={() => setOpenGroups((prev) => {
                  const next = { ...prev, [group.title]: !isOpen };
                  try { localStorage.setItem('menu.openGroups', JSON.stringify(next)); } catch { /* ignore localStorage errors */ }
                  return next;
                })} sx={{ color: '#fff', px: 0 }}>
                  <ListItemText primary={group.title} />
                  {isOpen ? <ExpandLess sx={{ color: '#fff' }} /> : <ExpandMore sx={{ color: '#fff' }} />}
                </ListItemButton>
              </ListSubheader>
              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <List disablePadding>
                  {visibleItems.map((item) => (
                    <ListItem key={item.text} disablePadding>
                      <ListItemButton
                        selected={location.pathname === item.path}
                        onClick={() => navigate(item.path)}
                        sx={{
                          pl: 2,
                          '&.Mui-selected': {
                            backgroundColor: 'rgba(25, 118, 210, 0.12)',
                            borderLeft: '4px solid #1976d2',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ color: '#fff' }}>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.text} sx={{ color: '#fff' }} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </List>
          );
        })}
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {
              // Determine current page title from top or grouped items
              (menuTop.find(item => item.path === location.pathname) ||
               menuGroups.flatMap(g => g.items).find(item => item.path === location.pathname))?.text ||
              'Dashboard'
            }
          </Typography>
          <NotificationBell />
          <Tooltip title="Tutoriale & Ghid">
            <IconButton color="inherit" onClick={openDrawer} sx={{ ml: 0.5 }}>
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
          <IconButton onClick={handleMenuOpen}>
            <Avatar sx={{ bgcolor: '#1976d2' }}>
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem disabled>
              <Typography variant="body2">{user?.email}</Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};
