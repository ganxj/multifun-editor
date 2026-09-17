/**
 * 语言自动识别自检（仅在 ?selftest=1 时按需加载）。
 *
 * 用法：打开 `/?selftest=1`，控制台执行 `await window.__detectSelfTest()`。
 *
 * 断言的是「识别出的 Monaco 语言 id」，不是「有没有识别出东西」——
 * 只判断非空的话，把 Python 认成 JavaScript 也会算通过。
 */
import { detectLanguage } from './detect';
import { SAMPLES } from './samples';

const sampleOf = (id) => SAMPLES.find((item) => item.id === id).content;

// 空状态里那三个示例是用户第一眼就会点的东西，它们的行为就是「识别能力」的对外演示。
// 所以直接拿真实示例内容来断言，而不是另抄一份近似文本：
// 以后谁改了 samples.js 的内容导致识别结果变了，这里会立刻红。
const SAMPLE_CASES = [
  { sample: sampleOf('json'), expect: 'json', note: '示例：JSON' },
  {
    sample: sampleOf('log'),
    expect: null,
    expectLabel: 'Log',
    note: '示例：日志（Monaco 无日志语言，只能如实提示不切换）',
  },
  { sample: sampleOf('config'), expect: 'ini', note: '示例：INI 配置' },
];

// 结构化规则应当直接判定的格式（不需要下载模型，瞬时完成）
const RULE_CASES = [
  { sample: '{"b":1,"a":[1,2,{"c":3}]}', expect: 'json', note: 'JSON' },
  {
    sample: '<!DOCTYPE html>\n<html><head><title>t</title></head><body><p>hi</p></body></html>',
    expect: 'html',
    note: 'HTML',
  },
  {
    sample: '<?xml version="1.0" encoding="UTF-8"?>\n<catalog><book id="1"><title>A</title></book></catalog>',
    expect: 'xml',
    note: 'XML',
  },
  {
    sample: 'SELECT u.id, u.name FROM users u JOIN orders o ON o.user_id = u.id\nWHERE u.age > 18\nORDER BY u.id;',
    expect: 'sql',
    note: 'SQL',
  },
  {
    sample: 'FROM node:20-alpine\nWORKDIR /app\nCOPY package.json ./\nRUN npm ci --omit=dev\nCMD ["node", "server.js"]',
    expect: 'dockerfile',
    note: 'Dockerfile',
  },
  {
    sample: '[server]\nhost = 127.0.0.1\nport = 8080',
    expect: 'ini',
    note: 'INI',
  },
  {
    sample: 'name: demo-service\nversion: 1.0.0\nendpoints:\n  - path: /health\n    method: GET',
    expect: 'yaml',
    note: 'YAML',
  },
  {
    sample: '# 标题\n\n说明文字。\n\n```js\nconst a = 1;\n```\n\n- 第一项\n- 第二项',
    expect: 'markdown',
    note: 'Markdown',
  },
  {
    sample: '#!/bin/bash\nset -euo pipefail\necho "hello"',
    expect: 'shell',
    note: 'Shell（shebang）',
  },
  {
    sample: 'name,age,city\nalice,30,beijing\nbob,25,shanghai\ncarol,41,guangzhou',
    expect: null,
    expectLabel: 'CSV',
    note: 'CSV（Monaco 无此语言）',
  },
  {
    sample: '[package]\nname = "demo"\nversion = "1.0.0"\nedition = "2021"',
    expect: null,
    expectLabel: 'TOML',
    note: 'TOML（Monaco 无此语言）',
  },
];

// 这些需要模型判断（首次会下载检测模型与权重）
const MODEL_CASES = [
  {
    language: 'python',
    sample: `import os
from typing import List

def read_files(paths: List[str]) -> dict:
    result = {}
    for path in paths:
        with open(path) as handle:
            result[path] = handle.read()
    return result

if __name__ == "__main__":
    print(read_files(["a.txt"]))`,
  },
  {
    language: 'java',
    sample: `package com.example.demo;

import java.util.HashMap;
import java.util.Map;

public class OrderService {
    private final Map<String, Order> orders = new HashMap<>();

    public Order find(String id) {
        if (!orders.containsKey(id)) {
            throw new IllegalArgumentException("not found: " + id);
        }
        return orders.get(id);
    }
}`,
  },
  {
    language: 'go',
    sample: `package main

import (
	"fmt"
	"net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "hello %s", r.URL.Path[1:])
}

func main() {
	http.HandleFunc("/", handler)
	http.ListenAndServe(":8080", nil)
}`,
  },
  {
    language: 'c',
    sample: `#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: %s <name>\\n", argv[0]);
        return 1;
    }
    printf("hello %s\\n", argv[1]);
    return 0;
}`,
  },
  {
    language: 'cpp',
    sample: `#include <iostream>
#include <string>

class Greeter {
public:
    explicit Greeter(std::string name) : name_(std::move(name)) {}

    void greet() const {
        std::cout << "hello " << name_ << std::endl;
    }

private:
    std::string name_;
};

int main() {
    Greeter greeter("world");
    greeter.greet();
    return 0;
}`,
  },
  {
    language: 'csharp',
    sample: `using System;
using System.Collections.Generic;

namespace Demo
{
    public class OrderService
    {
        private readonly Dictionary<string, Order> _orders = new();

        public Order Find(string id)
        {
            if (!_orders.TryGetValue(id, out var order))
            {
                throw new ArgumentException($"not found: {id}");
            }
            return order;
        }
    }
}`,
  },
  {
    language: 'ruby',
    sample: `require 'json'

class Greeter
  def initialize(name)
    @name = name
  end

  def greet
    puts "hello #{@name}"
  end
end

Greeter.new('world').greet`,
  },
  {
    language: 'php',
    sample: `<?php

declare(strict_types=1);

namespace App;

class OrderService
{
    private array $orders = [];

    public function find(string $id): Order
    {
        if (!isset($this->orders[$id])) {
            throw new \\RuntimeException("not found: {$id}");
        }
        return $this->orders[$id];
    }
}`,
  },
  {
    language: 'javascript',
    sample: `import { readFile } from 'node:fs/promises';

export async function loadConfig(path) {
  const raw = await readFile(path, 'utf8');
  const config = JSON.parse(raw);
  return { ...config, loadedAt: Date.now() };
}

const config = await loadConfig('./app.json');
console.log(config);`,
  },
  {
    language: 'javascript',
    sample: `const labels = ['a', 'b', 'c'];

export function pick(list, index) {
  const value = list[index];
  return value === undefined ? null : value;
}

export const size = (list) => (list.length > 0 ? list.length : 0);

console.log(labels.map((item) => item.toUpperCase()), pick(labels, 1), size(labels));`,
    note: 'JavaScript（含三元表达式，须与 TS 可选属性区分）',
  },
  {
    language: 'typescript',
    sample: `interface Order {
  id: string;
  total: number;
}

export class OrderService {
  private orders: Order[] = [];

  find(id: string): Order | undefined {
    return this.orders.find((order) => order.id === id);
  }
}`,
  },
  {
    language: 'rust',
    sample: `use std::collections::HashMap;

#[derive(Debug, Clone)]
struct Order {
    id: String,
    total: f64,
}

impl Order {
    fn describe(&self) -> String {
        format!("order {} total {}", self.id, self.total)
    }
}

fn main() {
    let mut orders: HashMap<String, Order> = HashMap::new();
    println!("{:?}", orders);
}`,
  },
  {
    language: 'kotlin',
    sample: `package com.example.demo

data class Order(val id: String, val total: Double)

class OrderService {
    private val orders = mutableMapOf<String, Order>()

    fun find(id: String): Order? = orders[id]

    fun total(): Double = orders.values.sumOf { it.total }
}

fun main() {
    val service = OrderService()
    println(service.total())
}`,
  },
];

function formatResult(result) {
  if (!result) return 'null';
  const parts = [
    `language=${result.language === null ? 'null' : result.language}`,
    `label=${result.label}`,
    `source=${result.source}`,
    `confidence=${result.confidence.toFixed(2)}`,
  ];
  return `{ ${parts.join(', ')} }`;
}

async function runCase(item, log) {
  const started = Date.now();
  let result = null;

  try {
    result = await detectLanguage(item.sample);
  } catch (error) {
    log(`[FAIL] ${item.note || item.language} 抛异常: ${(error && error.message) || String(error)}`);
    return false;
  }

  const elapsed = Date.now() - started;
  const label = item.note || item.language;
  const expectedLanguage = item.expect !== undefined ? item.expect : item.language;
  const actualLanguage = result ? result.language : null;

  const problems = [];
  if (!result) {
    problems.push('未识别出任何结果');
  } else {
    if (actualLanguage !== expectedLanguage) {
      problems.push(`语言不符，期望 ${expectedLanguage} 实得 ${actualLanguage}`);
    }
    if (item.expectLabel && result.label !== item.expectLabel) {
      problems.push(`名称不符，期望 ${item.expectLabel} 实得 ${result.label}`);
    }
    if (item.expect !== undefined && result.source !== 'rule') {
      problems.push(`未走规则路径，实际来自 ${result.source}`);
    }
    // 展示名必须是给人看的名字（约定首字母大写）。
    // 加这条是因为后处理切换语言时很容易顺手把 Monaco 的 id 当展示名塞进界面，
    // 只断言 language 的话这种错会静默通过（已经踩过一次）。
    if (result.language && !/^[A-Z]/.test(result.label)) {
      problems.push(`展示名不像展示名（疑似把语言 id 漏到界面）：${result.label}`);
    }
  }

  const ok = problems.length === 0;
  log(`[${ok ? 'PASS' : 'FAIL'}] ${label} (${elapsed}ms) -> ${formatResult(result)}`);
  problems.forEach((problem) => log(`        ${problem}`));
  if (result && result.reason) log(`        依据: ${result.reason}`);

  return ok;
}

export async function runDetectSelfTest() {
  const lines = [];
  const log = (text) => lines.push(text);
  let passed = 0;
  let total = 0;

  log('--- 结构化规则层（不应触发模型下载）---');
  for (const item of [...RULE_CASES, ...SAMPLE_CASES]) {
    total += 1;
    if (await runCase(item, log)) passed += 1;
  }

  log('');
  log('--- 模型层（首次会下载模型与权重）---');
  for (const item of MODEL_CASES) {
    total += 1;
    if (await runCase(item, log)) passed += 1;
  }

  log('');
  log(`==== ${passed}/${total} 通过 ====`);
  return lines.join('\n');
}

window.__detectSelfTest = runDetectSelfTest;
