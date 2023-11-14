#!/bin/sh

set -e

# Initialize default values for the arguments
DOMAIN=""

# Function to show usage
usage() {
    echo "Usage: $0 --domain <domain>"
    exit 1
}

# Parse the arguments
while [ "$#" -gt 0 ]; do
    case $1 in
        --domain) DOMAIN="$2"; shift ;;
        *) usage ;;
    esac
    shift
done

# Check if the required arguments are set
if [ -z "$DOMAIN" ]; then
    usage
fi

echo "Sorry, but at this time I am still building this script. Please subscribe to the waiting list at https://runs-on.com to be notified when this launches."
exit 0