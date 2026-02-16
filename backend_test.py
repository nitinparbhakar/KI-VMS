#!/usr/bin/env python3
"""
Backend API Testing for Visitor Management System
Tests all endpoints with comprehensive validation
"""

import requests
import json
import sys
import base64
from datetime import datetime
from typing import Dict, List, Optional

class VisitorManagementAPITester:
    def __init__(self, base_url: str = "https://workforce-entry-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_visitors = []  # Track created visitors for cleanup
        self.created_hosts = []     # Track created hosts for cleanup

    def log_result(self, test_name: str, success: bool, details: str = "", response_data: dict = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'response_data': response_data
        })

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int = 200, 
                 data: dict = None, params: dict = None) -> tuple[bool, dict]:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        
        try:
            if method == 'GET':
                response = self.session.get(url, params=params)
            elif method == 'POST':
                response = self.session.post(url, json=data, params=params)
            elif method == 'PUT':
                response = self.session.put(url, json=data)
            elif method == 'DELETE':
                response = self.session.delete(url)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {'text': response.text}

            details = f"Status: {response.status_code} (expected {expected_status})"
            if not success:
                details += f", Response: {response_data}"

            self.log_result(name, success, details, response_data)
            return success, response_data

        except Exception as e:
            self.log_result(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_departments(self):
        """Test GET /api/departments - Should return all 11 departments"""
        print("\n🏢 Testing Departments API")
        success, data = self.run_test("Get Departments", "GET", "departments")
        
        if success and data:
            departments = data.get('departments', [])
            expected_departments = [
                "HR", "Accounts", "IT", "Shipping", "Marketing",
                "Management", "Engineering", "Quality", "Production",
                "Tool Room", "Store"
            ]
            
            if len(departments) == 11 and all(dept in departments for dept in expected_departments):
                print(f"   All 11 departments found: {departments}")
                return True
            else:
                print(f"   ❌ Department mismatch. Got {len(departments)}: {departments}")
                return False
        return False

    def test_seed_data(self):
        """Test POST /api/seed - Should seed 17 hosts correctly"""
        print("\n🌱 Testing Seed Data API")
        success, data = self.run_test("Seed Data", "POST", "seed")
        
        if success:
            hosts_count = data.get('hosts_count', 0)
            if hosts_count == 17:
                print(f"   ✅ Successfully seeded {hosts_count} hosts")
                return True
            else:
                print(f"   ❌ Expected 17 hosts, got {hosts_count}")
                return False
        return False

    def test_hosts_api(self):
        """Test hosts endpoints"""
        print("\n👥 Testing Hosts API")
        
        # Test GET /api/hosts (all hosts)
        success, data = self.run_test("Get All Hosts", "GET", "hosts")
        if not success:
            return False
            
        all_hosts = data.get('hosts', [])
        print(f"   Total hosts: {len(all_hosts)}")
        
        # Test GET /api/hosts?department=HR (filtering)
        success, data = self.run_test("Get HR Hosts", "GET", "hosts", params={"department": "HR"})
        if success:
            hr_hosts = data.get('hosts', [])
            hr_count = len([h for h in hr_hosts if h.get('department') == 'HR'])
            if hr_count == len(hr_hosts):
                print(f"   ✅ HR department filter works: {hr_count} HR hosts")
            else:
                print(f"   ❌ HR filter failed: {hr_count} HR hosts out of {len(hr_hosts)}")
                return False
        
        # Test GET /api/hosts?department=IT (filtering)
        success, data = self.run_test("Get IT Hosts", "GET", "hosts", params={"department": "IT"})
        if success:
            it_hosts = data.get('hosts', [])
            it_count = len([h for h in it_hosts if h.get('department') == 'IT'])
            if it_count == len(it_hosts) and it_count > 0:
                print(f"   ✅ IT department filter works: {it_count} IT hosts")
                return True
            else:
                print(f"   ❌ IT filter failed: {it_count} IT hosts out of {len(it_hosts)}")
                return False
        
        return False

    def create_test_photo(self) -> str:
        """Create a base64 encoded test image"""
        # Create a minimal 1x1 pixel JPEG in base64
        # This is a valid minimal JPEG header + data
        minimal_jpeg = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\xaa\xff\xd9'
        return f"data:image/jpeg;base64,{base64.b64encode(minimal_jpeg).decode()}"

    def test_visitor_checkin(self):
        """Test POST /api/visitors/checkin - Creates visitor with proper ID format"""
        print("\n🚪 Testing Visitor Check-in API")
        
        # First get a host for the test
        success, data = self.run_test("Get IT Hosts for Checkin", "GET", "hosts", params={"department": "IT"})
        if not success or not data.get('hosts'):
            print("   ❌ No IT hosts available for checkin test")
            return False
            
        host = data['hosts'][0]
        test_photo = self.create_test_photo()
        
        checkin_data = {
            "name": "Test Visitor",
            "phone": "9876543210",
            "company": "Test Company",
            "purpose": "Meeting",
            "department": "IT",
            "host_id": host['id'],
            "host_name": host['name'],
            "host_email": host['email'],
            "photo": test_photo
        }
        
        success, data = self.run_test("Visitor Checkin", "POST", "visitors/checkin", 200, checkin_data)
        
        if success:
            visitor = data.get('visitor', {})
            visitor_id = visitor.get('visitor_id', '')
            
            # Validate visitor ID format: VIS-YYYYMMDD-####
            today = datetime.now().strftime("%Y%m%d")
            expected_prefix = f"VIS-{today}-"
            
            if visitor_id.startswith(expected_prefix) and len(visitor_id) == len(expected_prefix) + 4:
                print(f"   ✅ Visitor ID format correct: {visitor_id}")
                self.created_visitors.append(visitor_id)
                
                # Verify other fields
                if (visitor.get('name') == checkin_data['name'] and 
                    visitor.get('status') == 'IN' and
                    visitor.get('host_name') == host['name']):
                    print(f"   ✅ Visitor data correct")
                    return True
                else:
                    print(f"   ❌ Visitor data mismatch")
                    return False
            else:
                print(f"   ❌ Invalid visitor ID format: {visitor_id}")
                return False
        
        return False

    def test_visitor_checkout(self):
        """Test POST /api/visitors/checkout"""
        print("\n🚪 Testing Visitor Check-out API")
        
        if not self.created_visitors:
            print("   ❌ No checked-in visitors to test checkout")
            return False
            
        visitor_id = self.created_visitors[0]
        checkout_data = {"visitor_id": visitor_id}
        
        success, data = self.run_test("Visitor Checkout", "POST", "visitors/checkout", 200, checkout_data)
        
        if success:
            out_time = data.get('out_time')
            if out_time:
                print(f"   ✅ Checkout successful at: {out_time}")
                return True
            else:
                print(f"   ❌ No checkout time returned")
                return False
        
        return False

    def test_active_visitors(self):
        """Test GET /api/visitors/active - Returns only IN-status visitors"""
        print("\n👥 Testing Active Visitors API")
        
        success, data = self.run_test("Get Active Visitors", "GET", "visitors/active")
        
        if success:
            visitors = data.get('visitors', [])
            all_active = all(v.get('status') == 'IN' for v in visitors)
            
            if all_active:
                print(f"   ✅ All {len(visitors)} visitors have IN status")
                return True
            else:
                print(f"   ❌ Some visitors don't have IN status")
                return False
        
        return False

    def test_visitor_search(self):
        """Test GET /api/visitors/search with phone parameter"""
        print("\n🔍 Testing Visitor Search API")
        
        # Search by phone number
        success, data = self.run_test("Search by Phone", "GET", "visitors/search", params={"phone": "9876543210"})
        
        if success:
            visitors = data.get('visitors', [])
            total = data.get('total', 0)
            
            print(f"   ✅ Search returned {len(visitors)} visitors (total: {total})")
            
            # Verify phone filter works
            if visitors:
                phone_match = any('9876543210' in v.get('phone', '') for v in visitors)
                if phone_match:
                    print(f"   ✅ Phone search filter working")
                    return True
                else:
                    print(f"   ❌ Phone search filter not working")
            return True  # Empty results are also valid
        
        return False

    def test_visitor_slip(self):
        """Test GET /api/visitors/{visitor_id}/slip - Returns PDF"""
        print("\n📄 Testing Visitor Slip API")
        
        if not self.created_visitors:
            print("   ❌ No visitors to test slip generation")
            return False
            
        visitor_id = self.created_visitors[0]
        url = f"{self.base_url}/api/visitors/{visitor_id}/slip"
        
        try:
            response = self.session.get(url)
            success = response.status_code == 200
            
            if success:
                content_type = response.headers.get('content-type', '')
                if 'application/pdf' in content_type:
                    print(f"   ✅ PDF slip generated successfully ({len(response.content)} bytes)")
                    self.log_result("Get Visitor Slip PDF", True, f"PDF size: {len(response.content)} bytes")
                    return True
                else:
                    print(f"   ❌ Wrong content type: {content_type}")
                    self.log_result("Get Visitor Slip PDF", False, f"Wrong content type: {content_type}")
                    return False
            else:
                print(f"   ❌ Status: {response.status_code}")
                self.log_result("Get Visitor Slip PDF", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ Exception: {str(e)}")
            self.log_result("Get Visitor Slip PDF", False, f"Exception: {str(e)}")
            return False

    def test_stats_api(self):
        """Test GET /api/stats - Returns correct counts"""
        print("\n📊 Testing Stats API")
        
        success, data = self.run_test("Get Stats", "GET", "stats")
        
        if success:
            required_fields = ['active_visitors', 'today_visitors', 'today_checkouts', 'total_visitors']
            
            if all(field in data for field in required_fields):
                print(f"   ✅ All stat fields present")
                print(f"   Active: {data['active_visitors']}, Today: {data['today_visitors']}, "
                      f"Checkouts: {data['today_checkouts']}, Total: {data['total_visitors']}")
                return True
            else:
                missing = [f for f in required_fields if f not in data]
                print(f"   ❌ Missing fields: {missing}")
                return False
        
        return False

    def test_audit_log(self):
        """Test GET /api/audit-log - Returns audit entries"""
        print("\n📋 Testing Audit Log API")
        
        success, data = self.run_test("Get Audit Log", "GET", "audit-log")
        
        if success:
            logs = data.get('logs', [])
            total = data.get('total', 0)
            
            print(f"   ✅ Audit log returned {len(logs)} entries (total: {total})")
            
            # Verify audit log structure
            if logs:
                first_log = logs[0]
                required_fields = ['action', 'visitor_id', 'details', 'timestamp']
                if all(field in first_log for field in required_fields):
                    print(f"   ✅ Audit log structure correct")
                    return True
                else:
                    print(f"   ❌ Missing audit log fields")
                    return False
            return True  # Empty audit log is also valid
        
        return False

    def test_email_log(self):
        """Test GET /api/email-log - Returns mocked email entries"""
        print("\n📧 Testing Email Log API")
        
        success, data = self.run_test("Get Email Log", "GET", "email-log")
        
        if success:
            emails = data.get('emails', [])
            
            print(f"   ✅ Email log returned {len(emails)} entries")
            
            # Verify email log structure
            if emails:
                first_email = emails[0]
                required_fields = ['to', 'subject', 'body', 'sent_at', 'status']
                if all(field in first_email for field in required_fields):
                    print(f"   ✅ Email log structure correct")
                    if first_email.get('status') == 'MOCKED':
                        print(f"   ✅ Email status is MOCKED as expected")
                        return True
                    else:
                        print(f"   ❌ Email status should be MOCKED")
                        return False
                else:
                    print(f"   ❌ Missing email log fields")
                    return False
            return True  # Empty email log is also valid
        
        return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Backend API Tests for Visitor Management System")
        print(f"   Backend URL: {self.base_url}")
        print("=" * 70)
        
        # Run tests in sequence
        test_methods = [
            self.test_departments,
            self.test_seed_data, 
            self.test_hosts_api,
            self.test_visitor_checkin,
            self.test_active_visitors,
            self.test_visitor_checkout,
            self.test_visitor_search,
            self.test_visitor_slip,
            self.test_stats_api,
            self.test_audit_log,
            self.test_email_log
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                print(f"❌ {test_method.__name__} failed with exception: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Print failed tests
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   - {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = VisitorManagementAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)