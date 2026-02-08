import { useState, useEffect } from 'react';
import { 
  Clock, 
  TrendingUp, 
  Wallet, 
  Receipt, 
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { summaryApi, exportApi } from '../lib/api';
import { toast } from 'sonner';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function Dashboard() {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [year, month]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await summaryApi.get(year, month);
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
      toast.error('Failed to load monthly summary');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await exportApi.excel(year, month);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `salary_report_${year}_${String(month).padStart(2, '0')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel exported successfully');
    } catch (error) {
      toast.error('Failed to export Excel');
    }
  };

  const kpiCards = [
    {
      title: 'Total Hours',
      value: summary?.total_worked_hours?.toFixed(2) || '0.00',
      unit: 'hrs',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: 'Payable Hours',
      value: summary?.payable_hours?.toFixed(2) || '0.00',
      unit: 'hrs',
      subtext: `Max: 151.67 hrs`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      title: 'AZK Change',
      value: summary?.azk_change?.toFixed(2) || '0.00',
      unit: 'hrs',
      subtext: `Bank: ${summary?.azk_bank_total?.toFixed(2) || '0.00'} hrs`,
      icon: summary?.azk_change >= 0 ? ArrowUpRight : ArrowDownRight,
      color: summary?.azk_change >= 0 ? 'text-emerald-600' : 'text-orange-600',
      bgColor: summary?.azk_change >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-orange-50 dark:bg-orange-900/20',
    },
    {
      title: 'Net Pay',
      value: `€${summary?.net_pay?.toFixed(2) || '0.00'}`,
      unit: '',
      icon: Wallet,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  return (
    <div className="space-y-6 animate-in" data-testid="dashboard-page">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
            Monthly Summary
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your hours and earnings at a glance
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-3">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36" data-testid="month-selector">
              <Calendar className="w-4 h-4 mr-2 opacity-50" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28" data-testid="year-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            onClick={handleExportExcel}
            data-testid="export-excel-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <Card 
            key={kpi.title} 
            className="card-hover"
            data-testid={`kpi-card-${index}`}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                  </p>
                  <p className="text-2xl font-heading font-bold text-foreground mt-2">
                    <span className="font-mono">{kpi.value}</span>
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      {kpi.unit}
                    </span>
                  </p>
                  {kpi.subtext && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {kpi.subtext}
                    </p>
                  )}
                </div>
                <div className={`p-2.5 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart and Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <Card className="lg:col-span-2" data-testid="hours-chart-card">
          <CardHeader>
            <CardTitle className="font-heading">Daily Hours</CardTitle>
            <CardDescription>
              Work hours distribution for {months[month - 1]} {year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {summary?.daily_hours?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.daily_hours}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => [`${value} hrs`, 'Hours']}
                      labelFormatter={(label) => `Day ${label}`}
                    />
                    <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                      {summary.daily_hours.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.hours >= 6 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available for this period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card data-testid="financial-summary-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Financial Summary
            </CardTitle>
            <CardDescription>
              Breakdown for {months[month - 1]}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Base Pay</span>
                <span className="font-mono font-medium">
                  €{((summary?.payable_hours || 0) * 14.53).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Travel Allowance</span>
                <span className="font-mono font-medium">
                  €{summary?.travel_total?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Bonus (6+ hrs)</span>
                <span className="font-mono font-medium">
                  €{summary?.bonus_total?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm font-medium">Gross Pay</span>
                <span className="font-mono font-semibold">
                  €{summary?.gross_pay?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-red-600">Tax (27.64%)</span>
                <span className="font-mono text-red-600">
                  -€{summary?.tax?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t-2 border-primary/20">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg">Net Pay</span>
                <span className="font-mono font-bold text-2xl text-primary">
                  €{summary?.net_pay?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries */}
      <Card data-testid="recent-entries-card">
        <CardHeader>
          <CardTitle className="font-heading">Recent Entries</CardTitle>
          <CardDescription>
            Last {Math.min(5, summary?.entries?.length || 0)} work log entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Break</th>
                  <th>Hours</th>
                  <th>Gross</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {summary?.entries?.slice(0, 5).map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-mono">{entry.date}</td>
                    <td className="font-mono">{entry.start_time}</td>
                    <td className="font-mono">{entry.end_time}</td>
                    <td className="font-mono">{entry.break_hours}h</td>
                    <td className="font-mono font-medium">{entry.working_hours}h</td>
                    <td className="font-mono">€{entry.gross_pay.toFixed(2)}</td>
                    <td className="font-mono text-primary font-medium">
                      €{entry.net_pay.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {(!summary?.entries || summary.entries.length === 0) && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-8">
                      No entries for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
