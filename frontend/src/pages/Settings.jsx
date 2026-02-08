import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Settings as SettingsIcon, 
  Save, 
  Sun, 
  Moon,
  DollarSign,
  Clock,
  Percent,
  Mail,
  Building2,
  Shield,
  Loader2,
  Hourglass
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { settingsApi } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';

const settingsSchema = z.object({
  hourly_rate: z.number().min(0),
  contract_hours: z.number().min(0),
  tax_rate: z.number().min(0).max(1),
  company_name: z.string().min(1),
  email_address: z.string().email().optional().or(z.literal('')),
  email_password: z.string().optional(),
  smtp_server: z.string(),
  smtp_port: z.number().min(1).max(65535),
  auto_email_day: z.number().min(1).max(31),
  manual_azk_adjustment: z.number(),
});

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      hourly_rate: 14.53,
      contract_hours: 151.67,
      tax_rate: 0.2764,
      company_name: 'MUL Company',
      email_address: '',
      email_password: '',
      smtp_server: 'smtp.gmail.com',
      smtp_port: 587,
      auto_email_day: 1,
      manual_azk_adjustment: 0,
    },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await settingsApi.get();
      const data = response.data;
      
      setValue('hourly_rate', data.hourly_rate);
      setValue('contract_hours', data.contract_hours);
      setValue('tax_rate', data.tax_rate);
      setValue('company_name', data.company_name);
      setValue('email_address', data.email_address || '');
      setValue('email_password', data.email_password || '');
      setValue('smtp_server', data.smtp_server);
      setValue('smtp_port', data.smtp_port);
      setValue('auto_email_day', data.auto_email_day);
      setValue('manual_azk_adjustment', data.manual_azk_adjustment || 0);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      await settingsApi.update(data);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const watchValues = watch();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in" data-testid="settings-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your salary tracker preferences
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Appearance */}
        <Card data-testid="appearance-settings-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the look and feel of the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Toggle between light and dark theme
                </p>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
                data-testid="dark-mode-toggle"
              />
            </div>
          </CardContent>
        </Card>

        {/* Financial Configuration */}
        <Card data-testid="financial-settings-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Financial Configuration
            </CardTitle>
            <CardDescription>
              Configure salary calculation parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Hourly Rate */}
              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Hourly Rate (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('hourly_rate', { valueAsNumber: true })}
                  className="font-mono"
                  data-testid="hourly-rate-input"
                />
                {errors.hourly_rate && (
                  <p className="text-sm text-destructive">{errors.hourly_rate.message}</p>
                )}
              </div>

              {/* Contract Hours */}
              <div className="space-y-2">
                <Label htmlFor="contract_hours">Contract Hours/Month</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    {...register('contract_hours', { valueAsNumber: true })}
                    className="pl-10 font-mono"
                    data-testid="contract-hours-input"
                  />
                </div>
              </div>

              {/* Tax Rate */}
              <div className="space-y-2">
                <Label htmlFor="tax_rate">Tax Rate</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.0001"
                    {...register('tax_rate', { valueAsNumber: true })}
                    className="pl-10 font-mono"
                    data-testid="tax-rate-input"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Current: {(watchValues.tax_rate * 100).toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  {...register('company_name')}
                  className="pl-10"
                  data-testid="company-name-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Configuration */}
        <Card data-testid="email-settings-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Email Configuration
            </CardTitle>
            <CardDescription>
              Configure Gmail SMTP for sending payslips
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email Address */}
              <div className="space-y-2">
                <Label htmlFor="email_address">Gmail Address</Label>
                <Input
                  type="email"
                  {...register('email_address')}
                  placeholder="your.email@gmail.com"
                  data-testid="email-address-input"
                />
              </div>

              {/* App Password */}
              <div className="space-y-2">
                <Label htmlFor="email_password">App Password</Label>
                <Input
                  type="password"
                  {...register('email_password')}
                  placeholder="••••••••••••••••"
                  data-testid="email-password-input"
                />
              </div>

              {/* SMTP Server */}
              <div className="space-y-2">
                <Label htmlFor="smtp_server">SMTP Server</Label>
                <Input
                  {...register('smtp_server')}
                  data-testid="smtp-server-input"
                />
              </div>

              {/* SMTP Port */}
              <div className="space-y-2">
                <Label htmlFor="smtp_port">SMTP Port</Label>
                <Input
                  type="number"
                  {...register('smtp_port', { valueAsNumber: true })}
                  className="font-mono"
                  data-testid="smtp-port-input"
                />
              </div>
            </div>

            <Separator />

            {/* Auto Email Day */}
            <div className="space-y-2">
              <Label htmlFor="auto_email_day">Auto Email Day (of month)</Label>
              <Input
                type="number"
                min="1"
                max="31"
                {...register('auto_email_day', { valueAsNumber: true })}
                className="max-w-[200px] font-mono"
                data-testid="auto-email-day-input"
              />
              <p className="text-sm text-muted-foreground">
                Payslip will be sent automatically on day {watchValues.auto_email_day} of each month
              </p>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Gmail App Password:</strong> To send emails, you need to create an App Password in your Google Account settings. 
                Go to Google Account → Security → 2-Step Verification → App passwords.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card data-testid="security-notice-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              Security Notice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>• All sensitive data is stored securely in your database</p>
              <p>• Email passwords are stored as-is (consider using app-specific passwords)</p>
              <p>• This application does not share any data with external services</p>
              <p>• All calculations are performed locally</p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={saving}
            size="lg"
            data-testid="save-settings-btn"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
