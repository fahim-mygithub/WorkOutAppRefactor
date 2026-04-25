import shutil
import os

# Source and destination paths
source = r"C:\Users\fahim\Desktop\WorkoutApp\WorkoutAppPWA\public\muscle_exercises.csv"
dest = r"C:\Users\fahim\Desktop\WorkoutApp\WorkOutAppRefactor\public\muscle_exercises.csv"

# Check if source file exists
if os.path.exists(source):
    # Copy the file
    shutil.copy2(source, dest)
    print(f"Successfully copied {source} to {dest}")
    
    # Verify the copy by checking file sizes
    source_size = os.path.getsize(source)
    dest_size = os.path.getsize(dest)
    print(f"Source file size: {source_size:,} bytes")
    print(f"Destination file size: {dest_size:,} bytes")
    
    if source_size == dest_size:
        print("✅ File copy verified - sizes match")
    else:
        print("❌ File copy may have failed - sizes don't match")
        
    # Count lines in both files
    with open(source, 'r', encoding='utf-8') as f:
        source_lines = sum(1 for line in f)
    
    with open(dest, 'r', encoding='utf-8') as f:
        dest_lines = sum(1 for line in f)
        
    print(f"Source file lines: {source_lines:,}")
    print(f"Destination file lines: {dest_lines:,}")
    
    if source_lines == dest_lines:
        print("✅ Line count verified - counts match")
    else:
        print("❌ Line count mismatch")
        
else:
    print(f"❌ Source file not found: {source}")