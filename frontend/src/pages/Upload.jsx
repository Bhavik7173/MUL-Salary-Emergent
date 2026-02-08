import { useState, useCallback } from 'react';
import { 
  Upload as UploadIcon, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  X,
  Eye,
  Save
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { uploadApi } from '../lib/api';
import { toast } from 'sonner';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseResult, setParseResult] = useState(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFile(droppedFile)) {
      setFile(droppedFile);
      setParseResult(null);
    } else {
      toast.error('Please upload a CSV or Excel file');
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && isValidFile(selectedFile)) {
      setFile(selectedFile);
      setParseResult(null);
    } else {
      toast.error('Please upload a CSV or Excel file');
    }
  };

  const isValidFile = (file) => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    
    return validTypes.includes(file.type) || 
           validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const handleParse = async () => {
    if (!file) return;
    
    setParsing(true);
    try {
      const response = await uploadApi.parse(file);
      setParseResult(response.data);
      toast.success(`Parsed ${response.data.entries_count} entries`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!parseResult?.entries_preview) return;
    
    setSaving(true);
    try {
      const response = await uploadApi.save(parseResult.entries_preview);
      toast.success(response.data.message);
      setFile(null);
      setParseResult(null);
    } catch (error) {
      toast.error('Failed to save entries');
    } finally {
      setSaving(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParseResult(null);
  };

  return (
    <div className="space-y-6 animate-in" data-testid="upload-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
          Upload Data
        </h1>
        <p className="text-muted-foreground mt-1">
          Import work entries from CSV or Excel files
        </p>
      </div>

      {/* Upload Card */}
      <Card data-testid="upload-card">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <UploadIcon className="w-5 h-5 text-primary" />
            File Upload
          </CardTitle>
          <CardDescription>
            Drag and drop or select a file to upload
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div
              className={`dropzone ${isDragging ? 'active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input').click()}
              data-testid="dropzone"
            >
              <input
                id="file-input"
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="file-input"
              />
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-medium">
                    Drop your file here, or <span className="text-primary">browse</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports CSV, XLS, XLSX files
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-10 h-10 text-primary" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} data-testid="clear-file-btn">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Action Buttons */}
              {!parseResult && (
                <Button 
                  onClick={handleParse} 
                  disabled={parsing}
                  className="w-full"
                  data-testid="parse-file-btn"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {parsing ? 'Parsing...' : 'Preview Data'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parse Result */}
      {parseResult && (
        <Card data-testid="parse-result-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-heading flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Preview Results
                </CardTitle>
                <CardDescription>
                  {parseResult.entries_count} entries found
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {parseResult.columns_found.map((col) => (
                  <Badge key={col} variant="secondary">{col}</Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Preview Table */}
            <div className="overflow-x-auto mb-6">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Break</th>
                    <th>Hours</th>
                    <th>Travel</th>
                    <th>Gross</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.entries_preview.slice(0, 10).map((entry, idx) => (
                    <tr key={idx}>
                      <td className="font-mono">{entry.date}</td>
                      <td className="font-mono">{entry.start_time}</td>
                      <td className="font-mono">{entry.end_time}</td>
                      <td className="font-mono">{entry.break_hours}h</td>
                      <td className="font-mono font-medium">{entry.working_hours}h</td>
                      <td className="font-mono">€{entry.travel_allowance?.toFixed(2)}</td>
                      <td className="font-mono">€{entry.gross_pay?.toFixed(2)}</td>
                      <td className="font-mono text-primary font-medium">
                        €{entry.net_pay?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parseResult.entries_count > 10 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Showing first 10 of {parseResult.entries_count} entries
                </p>
              )}
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="flex-1"
                data-testid="save-entries-btn"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : `Save ${parseResult.entries_count} Entries`}
              </Button>
              <Button variant="outline" onClick={clearFile} data-testid="cancel-upload-btn">
                Cancel
              </Button>
            </div>

            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">Smart Merge Enabled</p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  Entries with duplicate dates will be skipped to prevent duplicates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Column Mapping Info */}
      <Card data-testid="column-mapping-card">
        <CardHeader>
          <CardTitle className="font-heading">Column Mapping</CardTitle>
          <CardDescription>
            The system will automatically detect these columns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'date', variants: 'Date, Datum, DATE' },
              { name: 'start_time', variants: 'Start Time, Start, Begin' },
              { name: 'end_time', variants: 'End Time, End, Einde' },
              { name: 'break_hours', variants: 'Break, Pauze, Break Hours' },
              { name: 'travel_allowance', variants: 'Travel, Reiskosten' },
              { name: 'notes', variants: 'Notes, Opmerkingen' },
            ].map((col) => (
              <div key={col.name} className="p-3 bg-muted rounded-lg">
                <p className="font-medium capitalize">{col.name.replace('_', ' ')}</p>
                <p className="text-xs text-muted-foreground mt-1">{col.variants}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
