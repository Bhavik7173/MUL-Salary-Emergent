import requests
import sys
import json
from datetime import datetime, date
from typing import Dict, Any

class MULSalaryTrackerTester:
    def __init__(self, base_url="https://salary-app.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_entry_id = None
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Dict[Any, Any] = None, files: Dict[str, Any] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            response_data = {}
            
            if success:
                try:
                    response_data = response.json() if response.content else {}
                except:
                    response_data = {"raw_response": "Non-JSON response"}
            
            self.log_test(name, success, 
                         f"Expected {expected_status}, got {response.status_code}" if not success else "")
            
            return success, response_data, response.status_code

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}, 0

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_settings_get(self):
        """Test getting settings"""
        return self.run_test("Get Settings", "GET", "settings", 200)

    def test_settings_update(self):
        """Test updating settings"""
        settings_data = {
            "hourly_rate": 15.00,
            "contract_hours": 160.0,
            "tax_rate": 0.25,
            "company_name": "Test Company",
            "dark_mode": True
        }
        return self.run_test("Update Settings", "PUT", "settings", 200, settings_data)

    def test_create_work_entry(self):
        """Test creating a work entry"""
        entry_data = {
            "date": "2024-01-15",
            "start_time": "09:00",
            "end_time": "17:30",
            "break_hours": 0.5,
            "travel_allowance": 5.0,
            "is_public_holiday": False,
            "notes": "Test entry"
        }
        success, response_data, status_code = self.run_test("Create Work Entry", "POST", "entries", 200, entry_data)
        
        if success and 'id' in response_data:
            self.created_entry_id = response_data['id']
            print(f"   Created entry with ID: {self.created_entry_id}")
        
        return success, response_data, status_code

    def test_get_all_entries(self):
        """Test getting all work entries"""
        return self.run_test("Get All Entries", "GET", "entries", 200)

    def test_get_single_entry(self):
        """Test getting a single work entry"""
        if not self.created_entry_id:
            self.log_test("Get Single Entry", False, "No entry ID available")
            return False, {}, 0
        
        return self.run_test("Get Single Entry", "GET", f"entries/{self.created_entry_id}", 200)

    def test_update_work_entry(self):
        """Test updating a work entry"""
        if not self.created_entry_id:
            self.log_test("Update Work Entry", False, "No entry ID available")
            return False, {}, 0
        
        update_data = {
            "notes": "Updated test entry",
            "travel_allowance": 10.0
        }
        return self.run_test("Update Work Entry", "PUT", f"entries/{self.created_entry_id}", 200, update_data)

    def test_monthly_summary(self):
        """Test getting monthly summary"""
        current_year = datetime.now().year
        current_month = datetime.now().month
        return self.run_test("Monthly Summary", "GET", f"summary/{current_year}/{current_month}", 200)

    def test_entries_with_filter(self):
        """Test getting entries with year/month filter"""
        current_year = datetime.now().year
        current_month = datetime.now().month
        return self.run_test("Filtered Entries", "GET", f"entries?year={current_year}&month={current_month}", 200)

    def test_pdf_generation(self):
        """Test PDF payslip generation"""
        current_year = datetime.now().year
        current_month = datetime.now().month
        success, response_data, status_code = self.run_test("PDF Generation", "GET", f"payslip/{current_year}/{current_month}/pdf", 200)
        return success, response_data, status_code

    def test_excel_export(self):
        """Test Excel export"""
        current_year = datetime.now().year
        current_month = datetime.now().month
        return self.run_test("Excel Export", "GET", f"export/{current_year}/{current_month}/excel", 200)

    def test_delete_work_entry(self):
        """Test deleting a work entry"""
        if not self.created_entry_id:
            self.log_test("Delete Work Entry", False, "No entry ID available")
            return False, {}, 0
        
        return self.run_test("Delete Work Entry", "DELETE", f"entries/{self.created_entry_id}", 200)

    def test_nonexistent_entry(self):
        """Test getting non-existent entry (should return 404)"""
        return self.run_test("Non-existent Entry", "GET", "entries/nonexistent-id", 404)

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting MUL Salary Tracker Backend Tests")
        print("=" * 50)

        # Test basic endpoints
        self.test_root_endpoint()
        self.test_settings_get()
        self.test_settings_update()

        # Test work entries CRUD
        self.test_create_work_entry()
        self.test_get_all_entries()
        self.test_get_single_entry()
        self.test_update_work_entry()
        self.test_entries_with_filter()

        # Test summary and exports
        self.test_monthly_summary()
        self.test_pdf_generation()
        self.test_excel_export()

        # Test delete (do this last)
        self.test_delete_work_entry()

        # Test error cases
        self.test_nonexistent_entry()

        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = MULSalaryTrackerTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())