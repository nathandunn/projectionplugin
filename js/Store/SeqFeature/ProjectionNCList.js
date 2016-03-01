define([
           'dojo/_base/declare',
           'dojo/_base/lang',
           'dojo/_base/array',
           'dojo/promise/all',
           'dojo/Deferred', 
           'JBrowse/Store/SeqFeature/NCList',
           'JBrowse/Model/SimpleFeature'
       ],
       function(
           declare,
           lang,
           array,
           all,
           Deferred,
           NCList,
           SimpleFeature
       ) {
return declare( NCList,
{
    getGlobalStats: function( successCallback, errorCallback ) {
        var projection = this.browser.config.projectionStruct;
        var s0,s1;
        if( projection ) {
            s0 = projection[0];
            s1 = projection[1];
        }
        return ( this._deferred.root || this.getDataRoot( s0.name ) )
           .then( function( data ) { successCallback( data.stats ); },
                  errorCallback
                );
    },


    getFeatures: function( query, origFeatCallback, finishCallback, errorCallback ) {
        var thisB = this;
        var rev = this.config.reverseComplement||this.browser.config.reverseComplement;
        var startBase = query.start;
        var endBase = query.end;
        var len = this.refSeq.length;
        var projection = this.browser.config.projectionStruct;

        if(rev) {
            query.start = len - endBase
            query.end = len - startBase
        }

        var offset = 0;
        var currseq;
        var nextseq;
        var cross = false;
        for(var i = 0; i < projection.length; i++) {
            currseq = projection[i].name;
            if(offset+projection[i].length > query.end) {
                break;
            }
            offset += projection[i].length;
        }
        //console.log('here',currseq, nextseq, offset+(projection[i]||{length:0}).length, query.start, offset, query.end);
        if(query.start < offset && offset < query.end) {
            nextseq = currseq;
            currseq = (projection[i-1]||{}).name||currseq;
            cross = true;
        }


        var flip = function(s) {
            return new SimpleFeature({
                id: s.get('id'),
                data: {
                    start: len-s.get('end'),
                    name: s.get('name'),
                    id: s.get('id'),
                    type: s.get('type'),
                    description: s.get('description'),
                    end: len-s.get('start'),
                    strand: -s.get('strand'),
                    subfeatures: array.map(s.get('subfeatures'), flip)
                }
            });
        }
        var shift = function(s) {
            var offset = 0;
            var seq = s.get('seq_id');
            for(var i=0; i<projection.length && seq!=projection[i].name;i++) {
                offset += projection[i].length;
            }
            return new SimpleFeature({
                id: s.get('id'),
                data: {
                    start: s.get('start') + offset,
                    end: s.get('end') + offset,
                    name: s.get('name'),
                    id: s.get('id'),
                    type: s.get('type'),
                    description: s.get('description'),
                    strand: s.get('strand'),
                    subfeatures: array.map(s.get('subfeatures'), shift)
                }
            });
        }
        var featCallback = function( feature ) {
            var ret = feature;
            //if(rev) ret = flip(feature);
            if(projection) ret = shift(feature);
            return origFeatCallback(ret);
        };

        if(!cross) {
            var q = {ref: currseq, start: query.start - offset, end: query.end - offset};
            this.inherited(arguments, [q, featCallback, finishCallback, errorCallback] );
        }
        else {
            //console.log(currseq,nextseq);
            var def1 = new Deferred();
            var def2 = new Deferred();
            var query1 = { ref: currseq, start: query.start, end: offset-1 };
            var query2 = { ref: nextseq, start: 0, end: query.end - offset };
            var supermethod = this.getInherited(arguments);
            var callback = function() {
                def1.resolve();
                supermethod.apply(thisB, [query2, featCallback, function() { def2.resolve(); }, errorCallback] );
            }
            supermethod.apply(this, [query1, featCallback, callback, errorCallback] );
            all([def1.promise,def2.promise]).then(finishCallback);
        }
    }

});
});

