#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Talk-To-My-Lawyer Application
Tests all user roles: Subscriber, Employee, System Admin, Attorney Admin
"""

import requests
import json
import sys
import time
from datetime import datetime
from typing import Dict, Any, Optional

class TalkToMyLawyerAPITester:
    def __init__(self, base_url="https://www.talk-to-my-lawyer.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'TalkToMyLawyer-APITester/1.0'
        })
        
        # Test accounts as specified in the review request
        self.test_accounts = {
            'subscriber': {
                'email': 'test-subscriber@ttml-test.com',
                'password': 'TestPass123!',
                'login_url': '/auth/login'
            },
            'employee': {
                'email': 'test-employee@ttml-test.com', 
                'password': 'TestPass123!',
                'login_url': '/auth/login'
            },
            'super_admin': {
                'email': 'test-superadmin@ttml-test.com',
                'password': 'TestPass123!',
                'login_url': '/secure-admin-gateway/login'
            },
            'attorney_admin': {
                'email': 'test-attorney@ttml-test.com',
                'password': 'TestPass123!', 
                'login_url': '/attorney-portal/login'
            }
        }
        
        self.tokens = {}
        self.test_results = {
            'total': 0,
            'passed': 0,
            'failed': 0,
            'errors': []
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.test_results['total'] += 1
        if success:
            self.test_results['passed'] += 1
            print(f"✅ {name}")
            if details:
                print(f"   {details}")
        else:
            self.test_results['failed'] += 1
            print(f"❌ {name}")
            if details:
                print(f"   {details}")
                self.test_results['errors'].append(f"{name}: {details}")

    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    headers: Dict = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request and return success status and response data"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=headers)
            else:
                return False, {'error': f'Unsupported method: {method}'}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {'status_code': response.status_code, 'text': response.text[:200]}
                
            return success, response_data
            
        except Exception as e:
            return False, {'error': str(e)}

    def test_health_endpoints(self):
        """Test basic health and status endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test basic health check
        success, data = self.make_request('GET', '/api/health')
        self.log_test("Health Check", success, f"Status: {data.get('status', 'unknown')}")
        
        # Test detailed health check
        success, data = self.make_request('GET', '/api/health/detailed')
        self.log_test("Detailed Health Check", success)

    def test_authentication_endpoints(self):
        """Test authentication for all user types"""
        print("\n🔐 Testing Authentication Endpoints...")
        
        for role, account in self.test_accounts.items():
            print(f"\n  Testing {role} authentication...")
            
            # Test login endpoint
            login_data = {
                'email': account['email'],
                'password': account['password']
            }
            
            # For admin roles, we might need different login endpoints
            if role in ['super_admin', 'attorney_admin']:
                # These might require special admin portal authentication
                success, response = self.make_request('POST', '/api/auth/admin-login', login_data)
            else:
                success, response = self.make_request('POST', '/api/auth/login', login_data)
            
            self.log_test(f"{role.title()} Login", success, 
                         f"Response: {response.get('message', response.get('error', 'No message'))}")
            
            if success and 'token' in response:
                self.tokens[role] = response['token']

    def test_subscriber_endpoints(self):
        """Test subscriber-specific endpoints"""
        print("\n👤 Testing Subscriber Endpoints...")
        
        if 'subscriber' not in self.tokens:
            print("⚠️  Skipping subscriber tests - no valid token")
            return
            
        headers = {'Authorization': f'Bearer {self.tokens["subscriber"]}'}
        
        # Test dashboard access
        success, data = self.make_request('GET', '/api/dashboard', headers=headers)
        self.log_test("Subscriber Dashboard", success)
        
        # Test profile settings
        success, data = self.make_request('GET', '/api/profile', headers=headers)
        self.log_test("Profile Settings", success)
        
        # Test letter generation
        letter_data = {
            'type': 'demand_letter',
            'sender_name': 'Test User',
            'sender_email': 'test@example.com',
            'recipient_name': 'Test Recipient',
            'issue_description': 'Test issue for API testing',
            'desired_outcome': 'Test resolution'
        }
        
        success, response = self.make_request('POST', '/api/letters/generate', letter_data, headers)
        self.log_test("Letter Generation", success)
        
        if success and 'letter_id' in response:
            letter_id = response['letter_id']
            
            # Test letter retrieval
            success, data = self.make_request('GET', f'/api/letters/{letter_id}', headers=headers)
            self.log_test("Letter Retrieval", success)
            
            # Test letter list
            success, data = self.make_request('GET', '/api/letters', headers=headers)
            self.log_test("Letters List", success)
        
        # Test subscription endpoints
        success, data = self.make_request('GET', '/api/subscription', headers=headers)
        self.log_test("Subscription Status", success)

    def test_employee_endpoints(self):
        """Test employee-specific endpoints"""
        print("\n👷 Testing Employee Endpoints...")
        
        if 'employee' not in self.tokens:
            print("⚠️  Skipping employee tests - no valid token")
            return
            
        headers = {'Authorization': f'Bearer {self.tokens["employee"]}'}
        
        # Test employee dashboard (should redirect to commissions)
        success, data = self.make_request('GET', '/api/dashboard/commissions', headers=headers)
        self.log_test("Employee Commissions Dashboard", success)
        
        # Test coupon management
        success, data = self.make_request('GET', '/api/dashboard/coupons', headers=headers)
        self.log_test("Employee Coupons", success)
        
        # Test employee settings
        success, data = self.make_request('GET', '/api/dashboard/employee-settings', headers=headers)
        self.log_test("Employee Settings", success)

    def test_admin_endpoints(self):
        """Test system admin endpoints"""
        print("\n🔧 Testing System Admin Endpoints...")
        
        if 'super_admin' not in self.tokens:
            print("⚠️  Skipping admin tests - no valid token")
            return
            
        headers = {'Authorization': f'Bearer {self.tokens["super_admin"]}'}
        
        # Test admin dashboard
        success, data = self.make_request('GET', '/api/secure-admin-gateway/dashboard', headers=headers)
        self.log_test("Admin Dashboard", success)
        
        # Test analytics
        success, data = self.make_request('GET', '/api/secure-admin-gateway/analytics', headers=headers)
        self.log_test("Admin Analytics", success)
        
        # Test user management
        success, data = self.make_request('GET', '/api/secure-admin-gateway/users', headers=headers)
        self.log_test("User Management", success)
        
        # Test all letters
        success, data = self.make_request('GET', '/api/secure-admin-gateway/letters', headers=headers)
        self.log_test("All Letters", success)
        
        # Test coupon management
        success, data = self.make_request('GET', '/api/secure-admin-gateway/coupons', headers=headers)
        self.log_test("Coupon Management", success)
        
        # Test commission management
        success, data = self.make_request('GET', '/api/secure-admin-gateway/commissions', headers=headers)
        self.log_test("Commission Management", success)

    def test_attorney_admin_endpoints(self):
        """Test attorney admin endpoints"""
        print("\n⚖️  Testing Attorney Admin Endpoints...")
        
        if 'attorney_admin' not in self.tokens:
            print("⚠️  Skipping attorney admin tests - no valid token")
            return
            
        headers = {'Authorization': f'Bearer {self.tokens["attorney_admin"]}'}
        
        # Test attorney review center
        success, data = self.make_request('GET', '/api/attorney-portal/review', headers=headers)
        self.log_test("Attorney Review Center", success)
        
        # Test pending letters
        success, data = self.make_request('GET', '/api/attorney-portal/letters/pending', headers=headers)
        self.log_test("Pending Letters", success)

    def test_payment_endpoints(self):
        """Test payment-related endpoints"""
        print("\n💳 Testing Payment Endpoints...")
        
        # Test Stripe configuration
        success, data = self.make_request('GET', '/api/stripe/config')
        self.log_test("Stripe Configuration", success)
        
        # Test subscription plans
        success, data = self.make_request('GET', '/api/subscription/plans')
        self.log_test("Subscription Plans", success)

    def test_role_access_control(self):
        """Test role-based access control"""
        print("\n🛡️  Testing Role Access Control...")
        
        # Test that attorney admin cannot access system admin endpoints
        if 'attorney_admin' in self.tokens:
            headers = {'Authorization': f'Bearer {self.tokens["attorney_admin"]}'}
            
            # Should be forbidden
            success, data = self.make_request('GET', '/api/secure-admin-gateway/analytics', 
                                            headers=headers, expected_status=403)
            self.log_test("Attorney Admin Blocked from Analytics", success)
            
            success, data = self.make_request('GET', '/api/secure-admin-gateway/users', 
                                            headers=headers, expected_status=403)
            self.log_test("Attorney Admin Blocked from User Management", success)

    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("🚀 Starting Talk-To-My-Lawyer API Testing Suite")
        print(f"🌐 Testing against: {self.base_url}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        try:
            self.test_health_endpoints()
            self.test_authentication_endpoints()
            self.test_subscriber_endpoints()
            self.test_employee_endpoints()
            self.test_admin_endpoints()
            self.test_attorney_admin_endpoints()
            self.test_payment_endpoints()
            self.test_role_access_control()
            
        except KeyboardInterrupt:
            print("\n⚠️  Testing interrupted by user")
        except Exception as e:
            print(f"\n❌ Unexpected error during testing: {str(e)}")
            self.test_results['errors'].append(f"Unexpected error: {str(e)}")
        
        self.print_summary()

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        total = self.test_results['total']
        passed = self.test_results['passed']
        failed = self.test_results['failed']
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        
        if total > 0:
            success_rate = (passed / total) * 100
            print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.test_results['errors']:
            print(f"\n🔍 FAILED TESTS:")
            for error in self.test_results['errors']:
                print(f"   • {error}")
        
        print(f"\n⏰ Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return failed == 0

def main():
    """Main test execution"""
    tester = TalkToMyLawyerAPITester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
