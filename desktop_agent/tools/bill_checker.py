"""
Electricity Bill Checker Tool for Pakistani Discos
Supports LESCO, GEPCO, FESCO, MEPCO, IESCO, PESCO, HESCO, SEPCO, QESCO, K-Electric.
"""

import re
import requests

class BillChecker:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    def check_pitc_bill(self, company: str, ref_no: str) -> dict:
        """
        Check electricity bill using standard PITC portal.
        ref_no: 14-digit reference number (can include RU / spaces / letters).
        """
        # Clean reference number
        clean_ref = re.sub(r'[^0-9A-Za-z]', '', ref_no)
        company_lower = company.lower().strip()

        # Format URL: e.g. https://bill.pitc.com.pk/lescobill/general?refno=...
        url = f"https://bill.pitc.com.pk/{company_lower}bill/general?refno={clean_ref}"
        
        try:
            res = requests.get(url, headers=self.headers, timeout=15)
            if res.status_code != 200:
                # Fallback to secondary endpoint
                url = f"http://bill.pitc.com.pk/{company_lower}bill?refno={clean_ref}"
                res = requests.get(url, headers=self.headers, timeout=15)

            html = res.text

            # Extract bill fields with robust regex
            name_match = re.search(r'NAME\s*&\s*ADDRESS\s*</[^>]+>\s*<[^>]+>\s*([^<]+)', html, re.IGNORECASE) or \
                         re.search(r'Consumer\s*Name[\s\S]*?<td[^>]*>([^<]+)</td>', html, re.IGNORECASE)
            
            amount_match = re.search(r'PAYABLE\s*WITHIN\s*DUE\s*DATE[\s\S]*?<[^>]+>([\d,]+)<', html, re.IGNORECASE) or \
                           re.search(r'PAYABLE\s*WITHIN\s*DUE\s*DATE[\s\S]*?(\d{2,}[\d,]+)', html, re.IGNORECASE)
            
            due_date_match = re.search(r'DUE\s*DATE[\s\S]*?<[^>]+>([\d]{1,2}[-\s][A-Za-z]{3}[-\s][\d]{2,4})<', html, re.IGNORECASE) or \
                             re.search(r'DUE\s*DATE[\s\S]*?(\d{2}[-\/]\d{2}[-\/]\d{4})', html, re.IGNORECASE)
            
            month_match = re.search(r'BILL\s*MONTH[\s\S]*?<[^>]+>([A-Za-z]{3}[-\s][\d]{2,4})<', html, re.IGNORECASE)

            consumer_name = name_match.group(1).strip() if name_match else "Consumer Record Found"
            amount_due = amount_match.group(1).strip() if amount_match else "N/A"
            due_date = due_date_match.group(1).strip() if due_date_match else "N/A"
            bill_month = month_match.group(1).strip() if month_match else "Current Month"

            if amount_due == "N/A" and "bill not found" in html.lower():
                return {
                    "success": False,
                    "error": f"No bill record found for reference number: {ref_no} on {company.upper()} portal. Please double-check the 14-digit number."
                }

            return {
                "success": True,
                "company": company.upper(),
                "reference_no": clean_ref,
                "consumer_name": consumer_name,
                "bill_month": bill_month,
                "amount_payable": f"Rs. {amount_due}",
                "due_date": due_date,
                "bill_url": url,
                "message": f"⚡ {company.upper()} Bill Summary:\n• Consumer: {consumer_name}\n• Month: {bill_month}\n• Payable Amount: Rs. {amount_due}\n• Due Date: {due_date}\n🔗 View Complete Bill: {url}"
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to fetch bill: {str(e)}"
            }

bill_checker = BillChecker()
