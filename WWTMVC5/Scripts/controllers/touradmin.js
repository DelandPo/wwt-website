﻿wwtng.controller('TourAdmin', [
    '$scope', 'dataproxy', '$timeout', '$routeParams', '$http', 'UIHelper','$modal',
    function ($scope, dataproxy, $timeout, $routeParams, $http, uiHelper, $modal) {
        var communityId = $scope.communityId = 596915;
        wwt.triggerResize();
        var init = function () {
            if (!$('#tourAdmin').length) {
                return notAuthorized();
            }
            uiHelper.fixLinks("tourAdmin");
            dataproxy.requireAuth().then(function (types) {
                $scope.types = types;
                if (!types.isAdmin) {
                    return notAuthorized();
                }
                getCommunityDetail();
            }, function (reason) {
                dataproxy.getAllTypes().then(function (types) {
                    $scope.types = types;
                    console.log(types);
                    getCommunityDetail();
                });
            });
        }

        function notAuthorized() {
            location.href = '#/';
            return false;
        }

        function getCommunityDetail() {
            dataproxy.getCommunityDetail(communityId).then(function (response) {
                $scope.community = response.community;
                updateCommunityContents();
            });
        }

        function updateCommunityContents() {
            var d1 = new Date();
            dataproxy.getCommunityContents(communityId).then(function (response) {
                $scope.community.contents = response.entities;
                $scope.community.communities = response.childCommunities;
                repairTourType();
                wwt.triggerResize();
                console.log('update details took ' + (new Date().valueOf() - d1.valueOf()));
            });
        }

        $scope.refreshCommunityDetail = updateCommunityContents;

        $scope.options = { activeTab: 'contents' }

        $scope.tabChange = function (tab) {
            $scope.options.activeTab = tab;
            wwt.triggerResize();
        }

        $scope.getAzureGuidFromTourGuid = function (guid) {
            var tour = $scope.getTourFromGuid(guid);
            return tour ? tour.ContentAzureID : null;
        }

        $scope.getTourFromGuid = function (guid) {

            var tourResult = null;
            $.each($scope.community.contents, function (i, tour) {
                if (tour.extData.tourGuid.toLowerCase() === guid.toLowerCase()) {
                    tourResult = tour;
                }
            });
            return tourResult;
        }
        $scope.getTourById = function (id) {
            var tourResult = null;
            $.each($scope.community.contents, function (i, tour) {
                if (tour.Id == id) {
                    tourResult = tour;
                }
            });
            return tourResult;
        }
        $scope.getFolderTours = function (folder) {
            var collection = [];
            var tours = folder.Description ? folder.Description.split(',') : [];
            $.each(tours, function (i, tourId) {
                if (tourId && tourId.length > 3) {
                    collection.push($scope.getTourById(tourId));
                }
            });
            return collection;
        }

        $scope.getFolderId = function (node) {
            var parent = node.parent();
            return $scope.getCommunityByName(parent.attr('Name')).Id;
        }

        $scope.getCommunityByName = function (name) {
            var community = null;
            name = name.toLowerCase();
            $.each($scope.community.communities, function (i, com) {
                if ($.trim(com.Name).toLowerCase() == name) {
                    community = com;
                }
            });
            return community;
        }

        var newTourModal = $modal({
            scope: $scope,
            contentTemplate: '/content/views/modals/edittour.html',
            show: false,
            title: 'Add New Tour'
        });
        var editTourModal = $modal({
            scope: $scope,
            contentTemplate: '/content/views/modals/edittour.html',
            show: false,
            title: 'Edit Tour'
        });
        // Show when some event occurs (use $promise property to ensure the template has been loaded)
        $scope.showTourModal = function (tour) {
            $scope.tour = tour;
            if (tour) {
                editTourModal.$promise.then(editTourModal.show);
            } else {
                newTourModal.$promise.then(newTourModal.show);
            }
        };

        $scope.buildXml = function () {
            var s = '<?xml version="1.0" encoding="UTF-8"?>\n<Folder>';
            var attr = function (attrName, value) {
                if (!value) {
                    value = '';
                }
                s += ' ' + attrName + '="' + value + '"';
            }
            $.each($scope.community.communities, function(i, c) {
                s += '\n  <Folder Name="' + c.Name + '" Group="Tour" Thumbnail="">';
                var tours = $scope.getFolderTours(c);
                $.each(tours, function(j,t) {
                    s += '\n      <Tour';
                    attr('Title', t.Name);
                    attr('ID', t.ContentAzureID);
                    attr('Description', t.Description.replace(/\\n/g,'\\n'));
                    attr('Classification', t.extData.classification);
                    attr('AuthorEmail', t.extData.authorEmail);
                    attr('Author', t.extData.author);
                    attr('AuthorUrl', '');
                    attr('AverageRating', t.Rating);
                    attr('LengthInSecs', t.TourLength);
                    attr('OrganizationUrl', t.extData.organizationUrl);
                    attr('OrganizationName', t.extData.organization);
                    attr('ITHList', t.extData.ithList);
                    attr('AstroObjectsList', '');
                    attr('Keywords', t.Tags.split(',').join(';').split(' ').join(''));
                    var related = t.extData.related;
                    if (typeof related != 'string') {
                        related = related.join(';');
                    }
                    attr('RelatedTours', related);
                    s += '/>';
                });
                s += '\n  </Folder>';
            });
            s += '\n</Folder>';
            console.log(s);
            $timeout(function() { $scope.tourXml = s; });
        }

        

        var repairTourType = function () {
            $scope.buildXml();
            $.each($scope.community.contents, function(i, tour) {
                var tourId = tour.Id;
                if (tour.ContentType === 7) {
                    dataproxy.getEditContent(tourId).then(function(tour) {
                        if (tour.ContentFileDetail.indexOf('~') === 0 || tour.ContentFileDetail.indexOf('~~') !== -1) {
                            tour.ContentFileDetail = ".wtt~0~" + tour.ContentDataID + "~application/x-wtt~" + tour.ID;
                            tour.ContentTypeID = 1;
                            tour.ContentTypeName = 'Tours';
                            tour.ContentType = 1;
                            tour.TypeID = 1;
                            if (tour.FileName.indexOf('.wtt') === -1) {
                                tour.FileName += '.wtt';
                            }
                            if (tour.extData) {
                                tour.Citation = "json://" + JSON.stringify(tour.extData);
                            }
                            dataproxy.saveEditedContent(tour).then(function(response) {
                                console.log('fixed tour', response);
                            });
                        }

                        $scope.tour = tour;
                        $scope.extData = tour.extData;
                        $scope.tourLoaded = true;

                        try {
                            $scope.AuthorThumbnailId = $scope.tour.PostedFileDetail[0].split('~')[2]; //".jpg~5226~bfa1553c-e7d3-4857-8a1e-56607bcc7543~image/jpeg~-1"
                        } catch (er) {
                            dataproxy.deleteContent(id).then($scope.$hide);
                            $scope.refreshCommunityDetail();
                        }

                    });
                }
            });
          
        }

        init();

        
    }]);