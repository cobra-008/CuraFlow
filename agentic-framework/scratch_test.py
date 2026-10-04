import asyncio
import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from agents.icu.activities import analyze_icu_status, IcuAnalysisInput

async def main():
    inp = IcuAnalysisInput(
        session_id="test_session",
        icu_admissions=[{"id": "adm-icu-1", "patient_token": "pt-icu-1", "bed_id": "bed-icu-1"}],
        non_icu_admissions=[{"id": "adm-ward-1", "patient_token": "pt-ward-1", "bed_id": "bed-ward-1"}],
        available_beds=[{"id": "bed-icu-2", "status": "Available", "is_icu": True}],
        bed_by_id={}
    )
    
    try:
        res = await analyze_icu_status(inp)
        print("Success!", res)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
