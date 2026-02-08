import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Mail, 
  Calendar,
  Eye,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { summaryApi, exportApi, emailApi } from '../lib/api';
import { toast } from 'sonner';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function Payslip() {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sending, setSending] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const response = await exportApi.pdf(year, month);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip_${year}_${String(month).padStart(2, '0')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Payslip downloaded successfully');
    } catch (error) {
      toast.error('Failed to download payslip');
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      toast.error('Please enter recipient email');
      return;
    }

    setSending(true);
    try {
      await emailApi.send({
        recipient_email: recipientEmail,
        year,
        month
      });
      toast.success('Email sent successfully');
      setRecipientEmail('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send email. Check email settings.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in" data-testid="payslip-page">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
            Payslip Generator
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate and send branded PDF payslips
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-3">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36" data-testid="payslip-month-selector">
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
            <SelectTrigger className="w-28" data-testid="payslip-year-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payslip Preview Card */}
        <Card data-testid="payslip-preview-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Payslip Preview
            </CardTitle>
            <CardDescription>
              {months[month - 1]} {year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : summary ? (
              <div className="border border-border rounded-lg p-6 bg-card">
                {/* Company Header */}
                <div className="text-center border-b border-border pb-4 mb-4">
                  <h2 className="text-xl font-heading font-bold">MUL Company</h2>
                  <p className="text-muted-foreground text-sm">Monthly Payslip</p>
                  <p className="text-muted-foreground text-sm">
                    {months[month - 1]} {year}
                  </p>
                </div>

                {/* Summary Table */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Total Worked Hours</span>
                    <span className="font-mono font-medium">{summary.total_worked_hours.toFixed(2)} hrs</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Payable Hours</span>
                    <span className="font-mono font-medium">{summary.payable_hours.toFixed(2)} hrs</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">AZK Change</span>
                    <span className={`font-mono font-medium ${summary.azk_change >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {summary.azk_change >= 0 ? '+' : ''}{summary.azk_change.toFixed(2)} hrs
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">AZK Bank Total</span>
                    <span className="font-mono font-medium">{summary.azk_bank_total.toFixed(2)} hrs</span>
                  </div>

                  <div className="pt-4">
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-muted-foreground">Travel Allowance</span>
                      <span className="font-mono">€{summary.travel_total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-muted-foreground">Bonus</span>
                      <span className="font-mono">€{summary.bonus_total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="font-medium">Gross Pay</span>
                      <span className="font-mono font-semibold">€{summary.gross_pay.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-red-600">Tax (27.64%)</span>
                      <span className="font-mono text-red-600">-€{summary.tax.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t-2 border-primary/30 bg-primary/5 -mx-6 px-6 py-4 -mb-6 rounded-b-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-lg">Net Pay</span>
                      <span className="font-mono font-bold text-2xl text-primary">
                        €{summary.net_pay.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No data available for this period
              </div>
            )}

            {/* Download Button */}
            <div className="mt-6 flex gap-3">
              <Button 
                onClick={handleDownloadPDF} 
                disabled={downloading || !summary}
                className="flex-1"
                data-testid="download-pdf-btn"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download PDF
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowPreview(true)}
                disabled={!summary}
                data-testid="preview-btn"
              >
                <Eye className="w-4 h-4 mr-2" />
                Full Preview
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email Card */}
        <Card data-testid="email-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Email Payslip
            </CardTitle>
            <CardDescription>
              Send payslip via email with PDF attachment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Email</Label>
                <Input
                  id="recipient"
                  type="email"
                  placeholder="employee@company.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  data-testid="recipient-email-input"
                />
              </div>

              <Button 
                onClick={handleSendEmail} 
                disabled={sending || !recipientEmail || !summary}
                className="w-full"
                data-testid="send-email-btn"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Send Payslip Email
              </Button>

              <div className="p-4 bg-muted rounded-lg mt-6">
                <h4 className="font-medium mb-2">Email will include:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• HTML formatted salary summary</li>
                  <li>• PDF payslip attachment</li>
                  <li>• Company branding</li>
                </ul>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> Configure your Gmail SMTP settings in the Settings page to enable email functionality.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entries for the Month */}
      {summary?.entries?.length > 0 && (
        <Card data-testid="payslip-entries-card">
          <CardHeader>
            <CardTitle className="font-heading">Work Entries for {months[month - 1]}</CardTitle>
            <CardDescription>
              {summary.entries.length} entries contributing to this payslip
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
                    <th>Travel</th>
                    <th>Bonus</th>
                    <th>Gross</th>
                    <th>Tax</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="font-mono">{entry.date}</td>
                      <td className="font-mono">{entry.start_time}</td>
                      <td className="font-mono">{entry.end_time}</td>
                      <td className="font-mono">{entry.break_hours}h</td>
                      <td className="font-mono font-medium">{entry.working_hours}h</td>
                      <td className="font-mono">€{entry.travel_allowance.toFixed(2)}</td>
                      <td className="font-mono">€{entry.bonus.toFixed(2)}</td>
                      <td className="font-mono">€{entry.gross_pay.toFixed(2)}</td>
                      <td className="font-mono text-red-600">€{entry.tax.toFixed(2)}</td>
                      <td className="font-mono text-primary font-medium">€{entry.net_pay.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td colSpan={4}>Totals</td>
                    <td className="font-mono">{summary.total_worked_hours.toFixed(2)}h</td>
                    <td className="font-mono">€{summary.travel_total.toFixed(2)}</td>
                    <td className="font-mono">€{summary.bonus_total.toFixed(2)}</td>
                    <td className="font-mono">€{summary.gross_pay.toFixed(2)}</td>
                    <td className="font-mono text-red-600">€{summary.tax.toFixed(2)}</td>
                    <td className="font-mono text-primary">€{summary.net_pay.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Payslip Preview</DialogTitle>
            <DialogDescription>
              {months[month - 1]} {year} - Full payslip preview
            </DialogDescription>
          </DialogHeader>
          
          {summary && (
            <div className="border border-border rounded-lg p-8 bg-white">
              {/* Header */}
              <div className="text-center border-b-2 border-primary pb-6 mb-6">
                <h2 className="text-2xl font-heading font-bold text-slate-900">MUL Company</h2>
                <p className="text-slate-600 mt-1">Official Payslip</p>
                <p className="text-slate-500 text-sm mt-2">
                  Period: {months[month - 1]} {year}
                </p>
              </div>

              {/* Content */}
              <div className="space-y-4 text-slate-900">
                <h3 className="font-semibold text-lg border-b pb-2">Hours Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Total Worked Hours:</div>
                  <div className="text-right font-mono">{summary.total_worked_hours.toFixed(2)} hrs</div>
                  <div>Payable Hours:</div>
                  <div className="text-right font-mono">{summary.payable_hours.toFixed(2)} hrs</div>
                  <div>AZK Change:</div>
                  <div className="text-right font-mono">{summary.azk_change.toFixed(2)} hrs</div>
                  <div>AZK Bank Total:</div>
                  <div className="text-right font-mono">{summary.azk_bank_total.toFixed(2)} hrs</div>
                </div>

                <h3 className="font-semibold text-lg border-b pb-2 mt-6">Financial Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Hourly Rate:</div>
                  <div className="text-right font-mono">€14.53</div>
                  <div>Base Pay:</div>
                  <div className="text-right font-mono">€{(summary.payable_hours * 14.53).toFixed(2)}</div>
                  <div>Travel Allowance:</div>
                  <div className="text-right font-mono">€{summary.travel_total.toFixed(2)}</div>
                  <div>Bonus:</div>
                  <div className="text-right font-mono">€{summary.bonus_total.toFixed(2)}</div>
                  <div className="font-medium">Gross Pay:</div>
                  <div className="text-right font-mono font-medium">€{summary.gross_pay.toFixed(2)}</div>
                  <div className="text-red-600">Tax (27.64%):</div>
                  <div className="text-right font-mono text-red-600">-€{summary.tax.toFixed(2)}</div>
                </div>

                <div className="mt-6 pt-4 border-t-2 border-primary bg-primary/5 -mx-8 px-8 py-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-xl">Net Pay</span>
                    <span className="font-mono font-bold text-3xl text-primary">
                      €{summary.net_pay.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t text-center text-xs text-slate-500">
                <p>Generated by MUL Salary Tracker</p>
                <p>This is an automatically generated document</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
