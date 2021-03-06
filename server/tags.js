Tags.allow({
      insert: function(userId) {
        return isAdminById(userId);
      },
      update: function(userId) {
        return isAdminById(userId);
      },
      remove: function(userId) {
        return isAdminById(userId);
      },
      fetch: []
    });

// publish all tags
Meteor.publish("tags", function() { 
  this.unblock(); // don't wait for this publication to finish to proceed
  return Tags.find({});
});

// add a new tag to Tags collection, 
var addTag = function (tagName) {
    if (! Validation.isNotEmpty(tagName))
            throw new Meteor.Error(413, 'Tag name cannot be empty.');
    tagName = tagName.toLowerCase();

    var tag = Tags.findOne({name: tagName}),
        tagId = !! tag && tag._id,
        tagSlug = !! tag && tag.slug;

    if (! tagId) {
        tagSlug = slugFuncs.getUniqueSlug(tagId, tagName, Tags);
        tagId = Tags.insert({ 'name': tagName, 'slug': tagSlug, 'usedCount': 0 });
    } 

    return { _id: tagId, name: tagName, slug: tagSlug }; 
};

Meteor.methods({
    // add a new tag to Tags collection
    addNewTag: function (tagName) {
        if (! isAdmin()) 
            throw new Meteor.Error(403, 'Permission denied'); 

        // add new, set usedCount to 0 because not used by media yet  
        return addTag(tagName);  
    },

    // add a new or existing tag to a single media
    addTagToMediaId: function (tagName, mediaId) {
        if (! isAdmin()) 
            throw new Meteor.Error(403, 'Permission denied'); 

        var tag = addTag(tagName),
            media = Media.findOne({ _id: mediaId });

        if(getIndexOf(media.metadata.tags, tag._id) < 0) {
           Media.update({_id: mediaId}, { $push: { 'metadata.tags': { '_id': tag._id, 'name': tag.name, 'slug': tag.slug }}});
           Tags.update({_id: tag._id}, {$inc: {usedCount: 1}});
        } 

    },

    // add a new or existing tag to multiple media
    addTagToMediaList: function (tagName, mediaList) {
        if (! isAdmin()) 
            throw new Meteor.Error(403, 'Permission denied'); 

        var tag = addTag(tagName),
            media;

        for(var i = 0; i < mediaList.length; i++) {
            media = Media.findOne({_id: mediaList[i]});

            if(getIndexOf(media.metadata.tags, tag._id) < 0) {
               Media.update({_id: mediaList[i]}, { $push: { 'metadata.tags': { '_id': tag._id, 'name': tag.name, 'slug': tag.slug }}});
               Tags.update({_id: tag._id}, {$inc: {usedCount: 1}});
            } 
        }

    },

    // update a tag's name/slug for all media with that tag
    updateTag: function (tagId, tagName) {
        if (! isAdmin()) 
            throw new Meteor.Error(403, 'Permission denied'); 

        if (! Validation.isNotEmpty(tagName))
            throw new Meteor.Error(413, 'Tag name cannot be empty.');
        tagName = tagName.toLowerCase();

        // check if tag name already exists
        var tagsWithNameCount = Tags.find({$and: [{_id: { $ne: tagId }}, {name: tagName}]}).count();

        if (tagsWithNameCount < 1) {
           tagSlug = slugFuncs.getUniqueSlug(tagId, tagName, Tags);
           Tags.update({ _id: tagId }, { $set: {'name': tagName, 'slug': tagSlug }});
           Media.update({ 'metadata.tags._id': tagId}, {$set: {'metadata.tags.$.name' : tagName,
                                                               'metadata.tags.$.slug' : tagSlug }}, {multi:1});

        } else {
          throw new Meteor.Error(413, 'Tag name "' + tagName + '" already exists.');
        }
    },

    // remove a tag from a single media
    removeTagFromMediaId: function (tagId, mediaId) { 
        if (!isAdmin()) 
          throw new Meteor.Error(403, 'Permission denied'); 
        Media.update({_id: mediaId}, { $pull: { 'metadata.tags': {'_id': tagId}}});
        Tags.update({_id: tagId}, {$inc: {usedCount: -1}});
    },

    // remove a tag from a list of media
    removeTagFromMediaList: function (tagId, mediaList) { 
        if (!isAdmin()) 
          throw new Meteor.Error(403, 'Permission denied');
        for(var i = 0; i < mediaList.length; i++) {
           Media.update({_id: mediaList[i]}, { $pull: { 'metadata.tags': {'_id': tagId}}}); 
           Tags.update({_id: tagId}, {$inc: {usedCount: -1}});
        } 
    },

    // decrement use count when media item is deleted 
    decrementTags: function (tags) {
      for(var i = 0; i < tags.length; i++) {
          Tags.update({_id: tags[i]}, {$inc: { usedCount: -1 }});
      }
    },
    // permanently remove every instance of a tag
    removeTag: function (tagId, mediaId) {
        if (!isAdmin()) 
          throw new Meteor.Error(403, 'Permission denied');
        Media.update({'metadata.tags._id': tagId}, { $pull: { 'metadata.tags': {'_id': tagId} }}, {multi:1});
        Tags.remove({_id: tagId});
    }
});
