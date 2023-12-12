/**
 * 原作者：[[User:Alexander Misel/admin.js]]，逆襲的天邪鬼修改。
 * 取自 oldid=45739798
 *
 * 修改内容：
 * 1. 把菜单移到了「更多」而不是在用户名左面
 * 2. 修正bug
 * 3. 繁簡共榮
 * 4. 等DOM完成再执行
 */

(function($, mw) {
    $(function() {
        var BLACKLIST = ['Xiplus-abot'];

        // Create portlet link
        var portletLinkOnline = mw.util.addPortletLink(
                'p-cactions',
                '#',
                wgULS('在线管理人员', '線上管理人員'));

        var rcstart,
            rcend,
            time;
        var users = [];
        var admins = [],
            iadmins = [],
            bureaucrats = [],
            oversighters = [],
            checkusers = [];
        var api = new mw.Api();

        // Bind click handler
        $(portletLinkOnline).find('a').click(function(e) {
            e.preventDefault();

            users = [];
            var usersExt = [];
            admins = [];
            iadmins = [];
            bureaucrats = [],
            oversighters = [],
            checkusers = [];

            // 最近更改30分钟内的编辑用户
            time = new Date();
            rcstart = time.toISOString();
            time.setMinutes(time.getMinutes() - 30);
            rcend = time.toISOString();

            //API:RecentChanges
            api.get({
                format: 'json',
                action: 'query',
                list: 'recentchanges',
                rcprop: 'user',
                rcstart: rcstart,
                rcend: rcend,
                rcshow: '!bot|!anon',
                rclimit: 500
            }).done(function(data) {
                $.each(data.query.recentchanges, function(i, item) {
                    users[i] = item.user;
                });
                api.get({
                    format: 'json',
                    action: 'query',
                    list: 'logevents',
                    leprop: 'user',
                    lestart: rcstart,
                    leend: rcend,
                    lelimit: 500
                }).done(function(data) {
                    $.each(data.query.logevents, function(i, item) {
                        usersExt[i] = item.user;
                    });

                    Array.prototype.push.apply(users, usersExt);

                    // 使用者名稱去重與分割
                    users = $.unique(users.sort());

                    var promises = [];
                    var mark = function(data) {
                        $.each(data.query.users, function(i, user) {
                            // 找到管理员，去除adminbot
                            if ($.inArray('bot', user.groups) === -1 && $.inArray(user.name, BLACKLIST)) {
                                if ($.inArray('sysop', user.groups) > -1) {
                                    admins[i] = user.name;
                                }
                                if ($.inArray('interface-admin', user.groups) > -1) {
                                    iadmins[i] = user.name;
                                }
                                if ($.inArray('bureaucrat', user.groups) > -1) {
                                    bureaucrats[i] = user.name;
                                }
                                // 监督员权限为suppress，但持有用户称为oversighter
                                if ($.inArray('suppress', user.groups) > -1) {
                                    oversighters[i] = user.name;
                                }
                                if ($.inArray('checkuser', user.groups) > -1) {
                                    checkusers[i] = user.name;
                                }
                            }
                        });
                    };
                    for (var i = 0; i < (users.length + 50) / 50; i++) {
                        promises.push(api.get({
                                format: 'json',
                                action: 'query',
                                list: 'users',
                                ususers: users.slice(i * 50, (i + 1) * 50).join('|'),
                                usprop: 'groups'
                            }).done(mark));
                    }

                    // 查询用户权限
                    $.when.apply($, promises).done(function() {
                        // 消除空值
                        var filter = function(n) {
                            return n;
                        };

                        admins = admins.filter(filter);
                        iadmins = iadmins.filter(filter);
                        bureaucrats = bureaucrats.filter(filter);
                        oversighters = oversighters.filter(filter);
                        checkusers = checkusers.filter(filter);

                        var userlink = function(user) {
                            var user2 = user.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&lt;');
                            return '<a href="/wiki/User:' + user2 + '" target="_blank">' + user2 + '</a>&nbsp;<small style="opacity:.75;">(<a href="/wiki/User talk:' + user2 + '" target="_blank">留言</a>)</small>　';
                        }

                        if (admins.length + iadmins.length + bureaucrats.length + oversighters.length + checkusers.length > 0) {
                            var adminsstring = [wgULS('<p>下面是最近30分钟之内在线的管理人员</p>', '<p>下面是最近30分鐘內的線上管理人員</p>')];

                            if (admins.length > 0) {
                                adminsstring.push('<p style="word-break:break-all;">' + wgULS('管理员', '管理員') + ' (' + admins.length + wgULS('个在线', '個在線') + ')：');
                                $.each(admins, function(i, e) {
                                    adminsstring.push(userlink(e));
                                });
                                adminsstring.push('</p>');
                            }

                            if (iadmins.length > 0) {
                                adminsstring.push('<p style="word-break:break-all;">' + wgULS('界面管理员', '介面管理員') + ' (' + iadmins.length + wgULS('个在线', '個在線') + ')：');
                                $.each(iadmins, function(i, e) {
                                    adminsstring.push(userlink(e));
                                });
                                adminsstring.push('</p>');
                            }

                            if (bureaucrats.length > 0) {
                                adminsstring.push('<p style="word-break:break-all;">' + wgULS('行政员', '行政員') + ' (' + bureaucrats.length + wgULS('个在线', '個在線') + ')：');
                                $.each(bureaucrats, function(i, e) {
                                    adminsstring.push(userlink(e));
                                });
                                adminsstring.push('</p>');
                            }

                            if (oversighters.length > 0) {
                                adminsstring.push('<p style="word-break:break-all;">' + wgULS('监督员', '監督員') + ' (' + oversighters.length + wgULS('个在线', '個在線') + ')：');
                                $.each(oversighters, function(i, e) {
                                    adminsstring.push(userlink(e));
                                });
                                adminsstring.push('</p>');
                            }

                            if (checkusers.length > 0) {
                                adminsstring.push('<p style="word-break:break-all;">' + wgULS('用户查核员', '用戶查核員') + ' (' + checkusers.length + wgULS('个在线', '個在線') + ')：');
                                $.each(checkusers, function(i, e) {
                                    adminsstring.push(userlink(e));
                                });
                                adminsstring.push('</p>');
                            }

                            mw.notify($(adminsstring.join('')));
                        } else {
                            mw.notify(wgULS('目前没有管理人员在线。', '目前沒有管理人員在線。'));
                        }
                    }).fail(function() {
                        mw.notify(wgULS('查询时发生错误，请稍后重试。', '查詢時發生錯誤，請稍後重試。'));
                    });
                });
            });
        });
    });
})(jQuery, mw);
