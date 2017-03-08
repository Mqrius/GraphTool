(function() {
    "use strict";

    function makeSet() {
        var es = [];
        return {
            add: function (e) {
                var i;
                for (i = 0; i < es.length; i += 1) {
                    if (es[i] === e) { return false; }
                }
                es.push(e);
                return true;
            },
            remove: function (e) {
                var i;
                for (i = 0; i < es.length; i += 1) {
                    if (es[i] === e) {
                        es.splice(i, 1);
                        return true;
                    }
                }
                return false;
            },
            removeAll: function () {
                es = [];
            },
            contains: function (e) {
                var i;
                for (i = 0; i < es.length; i += 1) {
                    if (es[i] === e) {
                        return true;
                    }
                }
                return false;
            },
            forEach: function (f) {
                var i, copy = [];
                for (i = 0; i < es.length; i += 1) {
                    copy.push(es[i]);
                }
                for (i = 0; i < copy.length; i += 1) {
                    f(copy[i]);
                }
            }
        };
    };

    function makeEvent() {
        var callbacks = makeSet();
        return {
            add: callbacks.add,
            remove: callbacks.remove,
            removeAll: callbacks.removeAll,
            fire: function (p1, p2, p3) {
                callbacks.forEach(function (callback) {
                    callback(p1, p2, p3);
                });
            }
        };
    };

    function element(tag, content) {
        var e = document.createElement(String(tag));
        if (content) {
            if (typeof content === "object") {
                e.appendChild(content);
            } else {
                e.textContent = String(content);
            }
        }
        return e;
    };


    function makeDraggable(subject) {
        var onstart = makeEvent(),
            onmove = makeEvent(),
            onend = makeEvent(),
            is_dragging = false,
            x = -1000,
            y = -1000;

        function checkmoved(e, fireevent) {
            e = e || window.event;
            if (!e) { return false; }
            try { e.preventDefault(); } catch (ignore) {}
            if (e.changedTouches &&
                    (e.changedTouches.length >= 1)) {
                e = e.changedTouches[0];
            }
            if (!e.pageX) { return; }
            if (!e.pageY) { return; }
            var dx = e.pageX - x,
                dy = e.pageY - y;
            if ((dx === 0) && (dy === 0)) { return; }
            x = e.pageX;
            y = e.pageY;
            if (fireevent) {
                onmove.fire({x: x, y: y, dx: dx, dy: dy});
            }
        }

        function move(e) {
            checkmoved(e, true);
            return false;
        }

        function end(e) {
            checkmoved(e, true);
            if (is_dragging) {
                is_dragging = false;
                document.removeEventListener('mousemove', move, false);
                document.removeEventListener('mouseup', end, false);
                document.removeEventListener('touchmove', move, false);
                document.removeEventListener('touchend', end, false);
                onend.fire();
            }
            return false;
        }

        function start(e) {
            if (e.target !== subject) {
                return;
            }
            try { e.preventDefault(); } catch (ignore) {}
            if (!is_dragging) {
                checkmoved(e, false);
                is_dragging = true;
                document.activeElement.blur();
                document.addEventListener('mousemove', move, false);
                document.addEventListener('mouseup', end, false);
                document.addEventListener('touchmove', move, false);
                document.addEventListener('touchend', end, false);
                onstart.fire({x: x, y: y});
            }
            return false;
        }

        subject.addEventListener('mousedown', start, false);
        subject.addEventListener('touchstart', start, false);

        return {
            onstart: onstart,
            onmove: onmove,
            onend: onend,
            clean: function () {
                end();
                onstart.removeAll();
                onmove.removeAll();
                onend.removeAll();
                subject.removeEventListener('mousedown', start, false);
                subject.removeEventListener('touchstart', start, false);
            }
        };
    }

    var sx = Math.round(window.innerWidth/2),
        sy = Math.round(window.innerHeight/2),
        updateAll = makeEvent(),
        nodes = makeSet(),
        edges = makeSet(),
        selectedNodes = makeSet();

    function collision(ax1, ax2, ay1, ay2, bx1, bx2, by1, by2) {
        [ax1, ax2] = (ax1 > ax2) ? [ax2, ax1] : [ax1, ax2];
        [ay1, ay2] = (ay1 > ay2) ? [ay2, ay1] : [ay1, ay2];
        [bx1, bx2] = (bx1 > bx2) ? [bx2, bx1] : [bx1, bx2];
        [by1, by2] = (by1 > by2) ? [by2, by1] : [by1, by2];
        return (
                   ((bx1 > ax1 && bx1 < ax2) || (bx2 > ax1 && bx2 < ax2))
                && ((by1 > ay1 && by1 < ay2) || (by2 > ay1 && by2 < ay2))
               );
    }
        
    function createEdge(obj1, obj2) {
        var edge = element("div");
        document.body.appendChild(edge);
        edge.style.zIndex = -1000;
        edge.style.height = "4px";
        edge.style.position = "absolute";
        edge.style.background = "#888";
        function drawedge(ax, ay, bx, by) {
            var angle = -Math.atan2(ay-by, bx-ax) * 180 / Math.PI;
            var length = Math.sqrt((ax-bx)*(ax-bx)+(ay-by)*(ay-by));
            edge.style.width = length + "px";
            edge.style.left = (sx + ax) + "px";
            edge.style.top = (sy + ay) - 2 + "px";
            edge.style.transform = "rotate(" + angle + "deg)";
            edge.style.transformOrigin = "0px 2px";
        }
        edge.upd = function () {
            var o1 = obj1.getcenter();
            var o2 = obj2.getcenter();
            drawedge(
                o1.x,
                o1.y,
                o2.x,
                o2.y
            );
        }
        var handle = {
            getel : function () {
                return edge;
            }
        };
        updateAll.add(edge.upd);
        edges.add(handle);
        return edge;
    }

    function createNode(x, y, block_style) {
        var node = element("div");
        document.body.appendChild(node);
        node.className = "node";
        if (block_style) {
            node.className += " " + block_style;
        }
        var connectedEdges = makeSet();
        var selected = false;
        
        function setselected (b) {
                if (b && !selected) {
                    node.classList.add("selected");
                    selectedNodes.add(handle);
                }
                if (!b && selected) {
                    node.classList.remove("selected");
                    selectedNodes.remove(handle);
                }
                selected = b;
        }
        
        function move (e) {
            x += e.dx;
            y += e.dy;
        }
        
        var handle = {
            getcenter : function () {
                return {
                    x : x + Math.round(node.offsetWidth / 2),
                    y : y + Math.round(node.offsetHeight / 2)
                };
            },
            getcorners : function () {
                return {
                    x1 : x,
                    y1 : y,
                    x2 : x + node.offsetWidth,
                    y2 : y + node.offsetHeight
                };
            },
            getselected : function () {
                return selected;
            },
            setselected : setselected,
            getel : function () {
                return node;
            },
            addedge : function (l) {
                connectedEdges.add(l);
            },
            move : move
        };
        function updEdges() {
            connectedEdges.forEach(function (l) {
                l.upd();
            });
        }
        function addbtn(dy) {
            var btn = element("div", "+");
            var style = block_style ? block_style :
                (dy > 0 ? "blockgreen" : "blockred");
            btn.className = "smallbtn " + style;
            btn.onclick = function () {
                var nn = createNode(
                    x + Math.round((node.offsetWidth - 78) / 2),
                    y + dy + ((dy > 0) ? node.offsetHeight - 64 : 0),
                    style);
                var nl = createEdge(nn, handle);
                nn.addedge(nl);
                handle.addedge(nl);
                nl.upd();
            };
            node.appendChild(btn);
        }
        function addtext() {
            var t = element("div");
            t.className = "edittext";
            t.contentEditable = true;
            t.addEventListener('input', updEdges, false);
            node.appendChild(t);
        }

        addbtn(-150);
        node.lastChild.style.top = "-40px";
        addtext();
        addbtn(150);
        node.lastChild.style.bottom = "-40px";

        var drag = makeDraggable(node);
        function upd() {
            node.style.left = (sx + x) + "px";
            node.style.top = (sy + y) + "px";
        }
        
        drag.onmove.add(function (e) {
            if (selected) {
                selectedNodes.forEach(function (node) {
                    node.move(e);
                });
                updateAll.fire();
            } else {
                move(e);
                upd();
                updEdges();
            }
        });
        upd();
        updateAll.add(upd);
        nodes.add(handle);
        return handle;
    }
    
    function createSelect() {
        var select = element("div");
        select.className = "select";
        var x1, y1, x2, y2;
        function upd() {
            select.style.left   = sx + Math.min(x1,x2) + "px";
            select.style.top    = sy + Math.min(y1,y2) + "px";
            select.style.width  =      Math.abs(x2-x1) + "px";
            select.style.height =      Math.abs(y2-y1) + "px";
        }
        function start(e) {
            x1 = e.x - sx;
            y1 = e.y - sy;
            x2 = e.x - sx;
            y2 = e.y - sy;
            document.body.appendChild(select);
            upd();
        }
        function move(e) {
            x2 += e.dx;
            y2 += e.dy;
            nodes.forEach(function (node) {
                var corners = node.getcorners();
                var col = collision(x1, x2, y1, y2, corners.x1, corners.x2, corners.y1, corners.y2);
                node.setselected(col);
            });
            upd();
        }
        function end(e) {
            document.body.removeChild(select);
        }
        return {
            start: start,
            move: move,
            end: end
        }
    }
    
    function initBody() {
        var drag = makeDraggable(document.body);
        var select = createSelect();
        drag.onstart.add(select.start);
        drag.onmove.add(select.move);
        drag.onend.add(select.end);
    }

    function unselect(e) {
        if (!e.target.classList.contains("selected")) {
            selectedNodes.forEach(function (node) {
                node.setselected(false);
            });
        }
    }
    
    function init() {
        initBody();
        createNode(-50, -50);
        document.addEventListener('mousedown', unselect, false);
    }

    setTimeout(init, 100);

}());
