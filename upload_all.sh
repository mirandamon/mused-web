#!/bin/bash

# Set the source directory (where your sound files are)
SOURCE_DIR="sounds"

# Set the destination bucket (your Firebase Storage bucket)
DESTINATION_BUCKET="gs://mused-5ef9f.firebasestorage.app/sounds"

# Check if the source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: Source directory '$SOURCE_DIR' does not exist."
  mkdir $SOURCE_DIR
  echo "Source directory $SOURCE_DIR has been created. Please add sound files to this folder."
  exit 1
fi

# Loop through all files in the source directory recursively
find "$SOURCE_DIR" -type f -print0 | while IFS= read -r -d $'\0' file; do
  # Get the relative path of the file within the source directory
  relative_path="${file#$SOURCE_DIR/}"

  # Construct the destination path in the bucket
  destination_path="$DESTINATION_BUCKET/$relative_path"

  # Check if the file is a .wav file (you can modify this for other types)
  if [[ "$file" == *.WAV ]] || [[ "$file" == *.wav ]]; then
    # Upload the file to the bucket with the correct content type
    echo "Uploading '$file' to '$destination_path'..."
    gsutil -h "Content-Type:audio/wav" cp "$file" "$destination_path"
  else
    echo "Skipping non-WAV file: '$file'"
  fi
done

echo "Upload complete."