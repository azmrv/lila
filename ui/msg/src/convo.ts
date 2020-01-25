import { h } from 'snabbdom'
import { VNode } from 'snabbdom/vnode'
import { Convo, ConvoMsg, Daily } from './interfaces'
import { userName, userIcon } from './util';
import * as enhance from './enhance';
import throttle from 'common/throttle';
import MsgCtrl from './ctrl';

export default function renderConvo(ctrl: MsgCtrl, convo: Convo): VNode {
  return h('div.msg-app__convo', {
    key: `${convo.thread.contact.id}:${convo.msgs[0].date.getDate()}`,
  }, [
    h('div.msg-app__convo__head', [
      h('div.msg-app__convo__head__contact', [
        userIcon(convo.thread.contact, 'msg-app__convo__head__icon'),
        h('div.msg-app__convo__head__name', userName(convo.thread.contact))
      ])
    ]),
    h('div.msg-app__convo__msgs', {
      hook: {
        insert: setupConvo,
        postpatch: setupConvo
      }
    }, [
      h('div.msg-app__convo__msgs__init'),
      h('div.msg-app__convo__msgs__content', renderMsgs(ctrl, convo))
    ]),
    h('div.msg-app__convo__reply', [
      h('textarea.msg-app__convo__reply__text', {
        attrs: {
          rows: 1,
          autofocus: 1
        },
        hook: {
          insert(vnode) {
            setupTextarea(vnode.elm as HTMLTextAreaElement, ctrl.post);
          }
        }
      })
    ])
  ]);
}

function renderMsgs(ctrl: MsgCtrl, convo: Convo): VNode[] {
  const dailies = groupMsgs(convo.msgs);
  const nodes: VNode[] = [];
  dailies.forEach(daily => nodes.push(...renderDaily(ctrl, daily)));
  return nodes;
}

function renderDaily(ctrl: MsgCtrl, daily: Daily): VNode[] {
  return [
    h('day', renderDate(daily.date)),
    ...daily.msgs.map(group =>
      h('group', group.map(msg => renderMsg(ctrl, msg)))
    )
  ];
}

function renderMsg(ctrl: MsgCtrl, msg: ConvoMsg) {
  return h(msg.user == ctrl.data.me.id ? 'mine' : 'their', [
    renderText(msg),
    h('em', `${pad2(msg.date.getHours())}:${pad2(msg.date.getMinutes())}`)
  ]);
}
function pad2(num: number): string {
  return (num < 10 ? '0' : '') + num;
}

function groupMsgs(msgs: ConvoMsg[]): Daily[] {
  let prev: ConvoMsg = msgs[0];
  if (!prev) return [];
  const dailies: Daily[] = [{
    date: prev.date,
    msgs: [[prev]]
  }];
  msgs.slice(1).forEach(msg => {
    if (sameDay(msg.date, prev.date)) {
      if (msg.user == prev.user) dailies[0].msgs[0].unshift(msg);
      else dailies[0].msgs.unshift([msg]);
    } else dailies.unshift({
      date: msg.date,
      msgs: [[msg]]
    });
    prev = msg;
  });
  return dailies;
}

const today = new Date();
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

function renderDate(date: Date) {
  if (sameDay(date, today)) return 'TODAY';
  if (sameDay(date, yesterday)) return 'YESTERDAY';
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function sameDay(d: Date, e: Date) {
  return d.getDate() == e.getDate() && d.getMonth() == e.getMonth() && d.getFullYear() == e.getFullYear();
}

function renderText(msg: ConvoMsg) {
    return enhance.isMoreThanText(msg.text) ? h('t', {
      key: msg.id,
      hook: {
        create(_, vnode: VNode) {
          (vnode.elm as HTMLElement).innerHTML = enhance.enhance(msg.text);
        }
      }
    }) : h('t', { key: msg.id }, msg.text);
}

function setupConvo(vnode: VNode) {
  (vnode.elm as HTMLElement).scrollTop = 9999999;
}

function setupTextarea(area: HTMLTextAreaElement, post: (text: string) => void) {

  // let savedValue = area.value;
  // area.value = '';
  let baseScrollHeight = area.scrollHeight;
  // area.value = savedValue;
  area.addEventListener('input', throttle(500, () =>
    setTimeout(() => {
      area.rows = 1;
      area.rows = Math.min(10, 1 + Math.ceil((area.scrollHeight - baseScrollHeight) / 19));
    })
  ));
  area.focus();

  area.addEventListener('keypress', (e: KeyboardEvent) =>
    setTimeout(() => {
      if ((e.which == 10 || e.which == 13) && !e.shiftKey) {
        const txt = area.value.trim();
        if (txt) post(txt);
        area.value = '';
        area.dispatchEvent(new Event('input'));
      }
    })
  );
}
