import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Calendar as CalendarIcon,
  Clock,
  Car,
  PartyPopper,
  FileText,
  Save,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { entriesApi, settingsApi } from '../lib/api';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const entrySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  break_hours: z.number().min(0).max(12),
  travel_allowance: z.number().min(0),
  is_public_holiday: z.boolean(),
  notes: z.string(),
});

export default function DailyEntry() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [settings, setSettings] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [preview, setPreview] = useState(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '17:00',
      break_hours: 0.5,
      travel_allowance: 0,
      is_public_holiday: false,
      notes: '',
    },
  });

  const watchAll = watch();

  useEffect(() => {
    fetchEntries();
    fetchSettings();
  }, []);

  useEffect(() => {
    calculatePreview();
  }, [watchAll, settings]);

  const fetchEntries = async () => {
    try {
      const response = await entriesApi.getAll();
      setEntries(response.data);
    } catch (error) {
      toast.error('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await settingsApi.get();
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const calculatePreview = () => {
    if (!settings) return;

    const { start_time, end_time, break_hours, travel_allowance, is_public_holiday } = watchAll;
    
    // Parse times
    const start = new Date(`2000-01-01T${start_time || '00:00'}`);
    const end = new Date(`2000-01-01T${end_time || '00:00'}`);
    
    let totalHours = (end - start) / 3600000;
    if (totalHours < 0) totalHours += 24; // Handle overnight
    
    const workingHours = Math.max(0, totalHours - (break_hours || 0));
    const bonus = workingHours >= 6 ? 1 : 0;
    const multiplier = is_public_holiday ? 1.5 : 1;
    
    const basePay = workingHours * settings.hourly_rate * multiplier;
    const grossPay = basePay + (travel_allowance || 0) + bonus;
    const tax = grossPay * settings.tax_rate;
    const netPay = grossPay - tax;

    setPreview({
      working_hours: workingHours.toFixed(2),
      bonus: bonus.toFixed(2),
      gross_pay: grossPay.toFixed(2),
      tax: tax.toFixed(2),
      net_pay: netPay.toFixed(2),
    });
  };

  const onSubmit = async (data) => {
    try {
      if (editingId) {
        await entriesApi.update(editingId, data);
        toast.success('Entry updated successfully');
        setEditingId(null);
      } else {
        await entriesApi.create(data);
        toast.success('Entry created successfully');
      }
      
      reset({
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '17:00',
        break_hours: 0.5,
        travel_allowance: 0,
        is_public_holiday: false,
        notes: '',
      });
      
      fetchEntries();
    } catch (error) {
      toast.error(editingId ? 'Failed to update entry' : 'Failed to create entry');
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setValue('date', entry.date);
    setValue('start_time', entry.start_time);
    setValue('end_time', entry.end_time);
    setValue('break_hours', entry.break_hours);
    setValue('travel_allowance', entry.travel_allowance);
    setValue('is_public_holiday', entry.is_public_holiday);
    setValue('notes', entry.notes || '');
    setSelectedDate(new Date(entry.date));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await entriesApi.delete(deleteId);
      toast.success('Entry deleted successfully');
      fetchEntries();
    } catch (error) {
      toast.error('Failed to delete entry');
    } finally {
      setDeleteId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
  };

  return (
    <div className="space-y-6 animate-in" data-testid="daily-entry-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
          Daily Work Entry
        </h1>
        <p className="text-muted-foreground mt-1">
          Log your daily working hours and allowances
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <Card className="lg:col-span-2" data-testid="entry-form-card">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              {editingId ? (
                <>
                  <Pencil className="w-5 h-5 text-primary" />
                  Edit Entry
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-primary" />
                  New Entry
                </>
              )}
            </CardTitle>
            <CardDescription>
              {editingId ? 'Update the work entry details' : 'Add a new work log entry'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                        data-testid="date-picker-trigger"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          setValue('date', format(date, 'yyyy-MM-dd'));
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.date && (
                    <p className="text-sm text-destructive">{errors.date.message}</p>
                  )}
                </div>

                {/* Public Holiday */}
                <div className="space-y-2">
                  <Label>Public Holiday</Label>
                  <div className="flex items-center gap-3 h-10">
                    <Switch
                      checked={watchAll.is_public_holiday}
                      onCheckedChange={(checked) => setValue('is_public_holiday', checked)}
                      data-testid="holiday-toggle"
                    />
                    <span className="text-sm text-muted-foreground">
                      {watchAll.is_public_holiday ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <PartyPopper className="w-4 h-4" />
                          1.5x Rate Applied
                        </span>
                      ) : 'Normal day'}
                    </span>
                  </div>
                </div>

                {/* Start Time */}
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      {...register('start_time')}
                      className="pl-10 font-mono"
                      data-testid="start-time-input"
                    />
                  </div>
                </div>

                {/* End Time */}
                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      {...register('end_time')}
                      className="pl-10 font-mono"
                      data-testid="end-time-input"
                    />
                  </div>
                </div>

                {/* Break Hours */}
                <div className="space-y-2">
                  <Label htmlFor="break_hours">Break Hours</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    max="12"
                    {...register('break_hours', { valueAsNumber: true })}
                    className="font-mono"
                    data-testid="break-hours-input"
                  />
                </div>

                {/* Travel Allowance */}
                <div className="space-y-2">
                  <Label htmlFor="travel_allowance">Travel Allowance (€)</Label>
                  <div className="relative">
                    <Car className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('travel_allowance', { valueAsNumber: true })}
                      className="pl-10 font-mono"
                      data-testid="travel-allowance-input"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    {...register('notes')}
                    placeholder="Optional notes about this work day..."
                    className="pl-10 min-h-[80px] resize-none"
                    data-testid="notes-input"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3">
                <Button type="submit" className="flex-1" data-testid="save-entry-btn">
                  <Save className="w-4 h-4 mr-2" />
                  {editingId ? 'Update Entry' : 'Save Entry'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={cancelEdit} data-testid="cancel-edit-btn">
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card data-testid="preview-card">
          <CardHeader>
            <CardTitle className="font-heading">Live Calculation</CardTitle>
            <CardDescription>
              Preview based on current input
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview && (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Working Hours</span>
                    <span className="font-mono font-medium">{preview.working_hours} hrs</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Bonus (6+ hrs)</span>
                    <span className="font-mono font-medium">€{preview.bonus}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm font-medium">Gross Pay</span>
                    <span className="font-mono font-semibold">€{preview.gross_pay}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-red-600">Tax (27.64%)</span>
                    <span className="font-mono text-red-600">-€{preview.tax}</span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t-2 border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Net Pay</span>
                    <span className="font-mono font-bold text-xl text-primary">
                      €{preview.net_pay}
                    </span>
                  </div>
                </div>

                {parseFloat(preview.working_hours) >= 6 && (
                  <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      <span className="font-semibold">Bonus earned!</span> You worked 6+ hours today.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Entries Table */}
      <Card data-testid="entries-table-card">
        <CardHeader>
          <CardTitle className="font-heading">Work Log</CardTitle>
          <CardDescription>
            All recorded work entries ({entries.length} total)
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
                  <th>Holiday</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className={editingId === entry.id ? 'bg-primary/5' : ''}>
                    <td className="font-mono">{entry.date}</td>
                    <td className="font-mono">{entry.start_time}</td>
                    <td className="font-mono">{entry.end_time}</td>
                    <td className="font-mono">{entry.break_hours}h</td>
                    <td className="font-mono font-medium">{entry.working_hours}h</td>
                    <td className="font-mono">€{entry.travel_allowance.toFixed(2)}</td>
                    <td>
                      {entry.is_public_holiday && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs">
                          Holiday
                        </span>
                      )}
                    </td>
                    <td className="font-mono">€{entry.gross_pay.toFixed(2)}</td>
                    <td className="font-mono text-primary font-medium">
                      €{entry.net_pay.toFixed(2)}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(entry)}
                          data-testid={`edit-entry-${entry.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(entry.id)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`delete-entry-${entry.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-muted-foreground py-8">
                      No entries yet. Add your first work log above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this work entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground" data-testid="confirm-delete-btn">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
