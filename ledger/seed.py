"""
ledger.seed – Seed script to populate initial Redis ledger state.
"""

from ledger import seed_ledger

def main():
    ledger = seed_ledger()
    print("Redis ledger seeded successfully:")
    print(f"  LKG version: {ledger.get_lkg()}")
    for r in ledger.list_releases():
        print(f"  Release: {r['version']} -> status={r['status']} image={r['image']}")

if __name__ == "__main__":
    main()
