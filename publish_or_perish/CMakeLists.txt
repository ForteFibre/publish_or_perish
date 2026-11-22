cmake_minimum_required(VERSION 3.10)
project(publish_or_perish)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(std_msgs REQUIRED)
find_package(std_srvs REQUIRED)

# 訳の表 (英語) から, ターミナルに出す文を引くヘッダーを作る
find_package(Python3 REQUIRED COMPONENTS Interpreter)
set(MESSAGES_EN_JSON ${CMAKE_CURRENT_SOURCE_DIR}/web/public/i18n/en.json)
set(MESSAGES_EN_HPP ${CMAKE_CURRENT_BINARY_DIR}/generated/publish_or_perish/messages_en.hpp)
add_custom_command(
  OUTPUT ${MESSAGES_EN_HPP}
  COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_CURRENT_BINARY_DIR}/generated/publish_or_perish
  COMMAND Python3::Interpreter ${CMAKE_CURRENT_SOURCE_DIR}/cmake/gen_messages.py ${MESSAGES_EN_JSON} ${MESSAGES_EN_HPP}
  DEPENDS ${MESSAGES_EN_JSON} ${CMAKE_CURRENT_SOURCE_DIR}/cmake/gen_messages.py
  COMMENT "en.json から messages_en.hpp を作る")

# 農場の規則・課題・点検・文言 (ROS に依存しない). ノードとテストが使う
add_library(farm_core STATIC src/world.cpp src/progress.cpp src/doctor.cpp src/messages.cpp ${MESSAGES_EN_HPP})
target_compile_features(farm_core PUBLIC cxx_std_17)
target_include_directories(farm_core PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<BUILD_INTERFACE:${CMAKE_CURRENT_BINARY_DIR}/generated>)

add_executable(farm_node src/farm_node.cpp)
# ament_target_dependencies は Lyrical で無くなったので, ターゲットを直接つなぐ (Jazzy でも同じに動く)
target_link_libraries(farm_node farm_core
  rclcpp::rclcpp ${geometry_msgs_TARGETS} ${nav_msgs_TARGETS} ${std_msgs_TARGETS} ${std_srvs_TARGETS})

install(TARGETS farm_node DESTINATION lib/${PROJECT_NAME})
install(DIRECTORY launch scripts models DESTINATION share/${PROJECT_NAME})
# 画面は web/ のソースから作った web/dist を入れる (作り方は web/Dockerfile の先頭)
if(EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/web/dist/index.html)
  install(DIRECTORY web/dist/ DESTINATION share/${PROJECT_NAME}/web)
else()
  message(WARNING "web/dist がないので画面を入れない. このディレクトリで docker build -f web/Dockerfile --output type=local,dest=web/dist . を実行してから colcon build し直す")
endif()
install(PROGRAMS scripts/match_sim.py DESTINATION lib/${PROJECT_NAME})
# 訳の表. match_sim.py が英語の文を引くのに使う (画面は web/dist に入った写しを使う)
install(DIRECTORY web/public/i18n DESTINATION share/${PROJECT_NAME})

if(BUILD_TESTING)
  find_package(ament_cmake_gtest REQUIRED)
  ament_add_gtest(test_messages test/test_messages.cpp)
  target_link_libraries(test_messages farm_core)
endif()

ament_package()
