#!/usr/bin/env python3
"""
Seed Image Receiver Node
Subscribes to `/gcs/seed_image` and saves the base64 payload as `latest_seed.jpg`.
"""

import rospy
from std_msgs.msg import String
import base64
import os

SAVE_PATH = "latest_seed.jpg"

def callback(data):
    rospy.loginfo("Received seed image from GCS!")
    try:
        # The dataUrl from JS looks like: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
        # We need to strip off the header.
        base64_str = data.data
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        
        image_data = base64.b64decode(base64_str)
        
        with open(SAVE_PATH, 'wb') as f:
            f.write(image_data)
            
        rospy.loginfo(f"Successfully saved seed image to: {os.path.abspath(SAVE_PATH)}")
        
    except Exception as e:
        rospy.logerr(f"Failed to process and save seed image: {e}")

def listener():
    rospy.init_node('seed_image_receiver', anonymous=True)
    rospy.Subscriber("/gcs/seed_image", String, callback)
    rospy.loginfo(f"Seed Receiver initialized. Listening on /gcs/seed_image")
    rospy.loginfo(f"Images will be saved to: {os.path.abspath(SAVE_PATH)}")
    rospy.spin()

if __name__ == '__main__':
    listener()
