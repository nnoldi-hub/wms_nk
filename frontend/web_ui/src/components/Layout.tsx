import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, AppBar, IconButton, Typography, Avatar, Menu, MenuItem } from '@mui/material';
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
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import { useAuth } from '../hooks/useAuth';

const drawerWidth = 260;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Produse', icon: <InventoryIcon />, path: '/products' },
    { text: 'Comenzi', icon: <ChecklistIcon />, path: '/orders' },
  { text: 'Batches', icon: <ViewModuleIcon />, path: '/batches' },
  { text: 'Transformari', icon: <TransformIcon />, path: '/transformations' },
  { text: 'Scanare', icon: <QrCodeScannerIcon />, path: '/scan' },
  { text: 'Setare Inițială', icon: <SettingsApplicationsIcon />, path: '/initial-setup' },
  { text: 'Configurare Depozit', icon: <WarehouseIcon />, path: '/warehouse-config' },
  { text: 'Pick Jobs', icon: <PlaylistAddCheckIcon />, path: '/pick-jobs' },
  { text: 'Croitorie', icon: <ContentCutIcon />, path: '/cutting' },
  { text: 'Cusut', icon: <ChecklistIcon />, path: '/sewing' },
  { text: 'Control Calitate', icon: <ChecklistIcon />, path: '/qc' },
  { text: 'Expedieri', icon: <LocalShippingIcon />, path: '/shipments' },
  { text: 'Utilizatori', icon: <PeopleIcon />, path: '/utilizatori' },
  { text: 'Rapoarte', icon: <AssessmentIcon />, path: '/reports' },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

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
      <List>
        {menuItems.map((item) => (
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
            {menuItems.find(item => item.path === location.pathname)?.text || 'Dashboard'}
          </Typography>
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
