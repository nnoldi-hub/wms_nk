import axios from 'axios';

const REPORTS_API = 'http://localhost:3019';

export const reportsService = {
  async ping() {
    try {
      const res = await axios.get(`${REPORTS_API}/health`);
      return res.data;
    } catch {
      return { success: false };
    }
  },
};
