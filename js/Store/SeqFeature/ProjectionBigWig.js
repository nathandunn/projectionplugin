define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/Deferred',
    'dojo/promise/all',
    'JBrowse/Store/SeqFeature/BigWig',
    'JBrowse/Model/SimpleFeature'
],
       function(
           declare,
           lang,
           array,
           Deferred,
           all,
           BigWig,
           SimpleFeature
       ) {
           return declare(BigWig,
               {
                   getFeatures: function(query, origFeatCallback, finishCallback, errorCallback) {
                       var thisB = this;
                       var projection = this.browser.config.projectionStruct;

                       var offset = 0;
                       var currseq;
                       var nextseq;
                       var cross = false;

                       for (var i = 0; i < projection.length; i++) {
                           currseq = projection[i].name;
                           if (offset + projection[i].length > query.end) {
                               break;
                           }
                           offset += projection[i].length;
                       }

                       var shift = function(s, r) {
                           var poffset = 0;
                           for (var j = 0; j < projection.length && r !== projection[j].name; j++) {
                               poffset += projection[j].length;
                           }
                           return new SimpleFeature({
                               id: s.get('id'),
                               data: {
                                   start: s.get('start') + poffset,
                                   end: s.get('end') + poffset,
                                   score: s.get('score'),
                                   strand: s.get('strand')
                               }
                           });
                       };

                       var featCallback = function(seqId) {
                           return function(feature) {
                               var ret = feature;
                               if (projection) ret = shift(feature, seqId);
                               return origFeatCallback(ret);
                           };
                       };

                       if (!cross) {
                           var q = {ref: currseq, start: query.start - offset, end: query.end - offset};
                           this.inherited(arguments, [q, featCallback(currseq), finishCallback, errorCallback]);
                       } else {
                           var def1 = new Deferred();
                           var def2 = new Deferred();
                           var query1 = { ref: currseq, start: query.start, end: offset - 1 };
                           var query2 = { ref: nextseq, start: 0, end: query.end - offset };
                           var supermethod = this.getInherited(arguments);
                           var callback = function() {
                               def1.resolve();
                               supermethod.apply(thisB, [query2, featCallback(nextseq), function() { def2.resolve(); }, errorCallback]);
                           };
                           supermethod.apply(this, [query1, featCallback(currseq), callback, errorCallback]);
                           all([def1.promise, def2.promise]).then(finishCallback);
                       }
                   }

               });
       });

