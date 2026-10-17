import time
import sys
from kaggle.api.kaggle_api_extended import KaggleApi

def main():
    api = KaggleApi()
    api.authenticate()
    kernel_id = 'bushraansari11/wan21-autopost-engine'
    print(f"Monitoring {kernel_id}...", flush=True)
    
    last_status = None
    while True:
        try:
            status_obj = api.kernels_status(kernel_id)
            current_status = str(status_obj.status)
            if current_status != last_status:
                print(f"Status update: {current_status}", flush=True)
                last_status = current_status
            
            if "COMPLETE" in current_status.upper():
                print(f"[COMPLETE] Kernel execution has completed! Status: {current_status}", flush=True)
                break
            elif "ERROR" in current_status.upper():
                print(f"[ERROR] Kernel encountered error! Status: {current_status}", flush=True)
                break
        except Exception as e:
            print(f"Polling error: {e}", flush=True)
        
        time.sleep(20)

if __name__ == '__main__':
    main()
