import mongomock
import pymongo

# Use an in-memory MongoDB for every test. This must run before db.py is imported.
pymongo.MongoClient = mongomock.MongoClient
