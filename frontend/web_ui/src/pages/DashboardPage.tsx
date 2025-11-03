import { Card, CardContent, Typography, Box, Grid } from '@mui/material';
import InventoryIcon from '@mui/icons-material/Inventory';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

export const DashboardPage = () => {
  const stats = [
    { title: 'Total Produse', value: '1,247', icon: <InventoryIcon fontSize="large" />, color: '#1976d2' },
    { title: 'Comenzi Active', value: '42', icon: <PendingActionsIcon fontSize="large" />, color: '#f57c00' },
    { title: 'Expedieri Azi', value: '18', icon: <LocalShippingIcon fontSize="large" />, color: '#388e3c' },
    { title: 'Productivitate', value: '92%', icon: <TrendingUpIcon fontSize="large" />, color: '#d32f2f' },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {stats.map((stat) => (
          <Grid key={stat.title} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography color="textSecondary" variant="body2" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4">{stat.value}</Typography>
                  </Box>
                  <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box mt={4}>
        <Typography variant="h6" gutterBottom>
          Activitate Recenta
        </Typography>
        <Card>
          <CardContent>
            <Typography color="textSecondary">
              Grafice și date în timp real vor fi afișate aici...
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
